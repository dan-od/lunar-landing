// The v1 API: /v1/sites, /v1/sky, /v1/windows. Pages and the (later) assistant
// connector read these, so there is one source of answers. Every reply names the
// scenario and the model used.
import { Router, type Request } from 'express';
import type { BodySummary, Site } from '@moon/core';
import { computeResult, stateFor } from '@moon/core';
import { notFound, serviceUnavailable } from './errors.js';
import { parseDate, parseInteger, parseNumber, parsePlace, type PlaceQuery } from './validate.js';
import { createRateLimiter, type RateLimitOptions } from './rateLimit.js';
import type { SeriesProvider, SitesRepo } from './providers.js';
import type { HorizonsSpan } from '../horizons/client.js';

export interface V1Deps {
  sitesRepo: SitesRepo;
  seriesProvider: SeriesProvider;
  rateLimit?: RateLimitOptions;
}

const addDays = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const isoAt = (date: string, hour: number): string =>
  `${date}T${String(hour).padStart(2, '0')}:00:00Z`;

function adhocSite(lat: number, lon: number): Site {
  return {
    id: 'point',
    name: `Custom point ${lat}, ${lon}`,
    short: 'Custom',
    lat,
    lon,
    heightKm: 0,
    source: '(custom point)',
    hasTerrain: false,
    custom: true,
  };
}

function serializeSummary(s: BodySummary) {
  return {
    uptime_pct: s.uptimePct,
    longest_gap_days: s.longestGapDays,
    next_change_hours: s.nextChangeHours,
    windows: s.windows.map((w) => ({ start: w.start, end: w.end, hours: w.hours })),
  };
}

export function createV1Router(deps: V1Deps): Router {
  const router = Router();
  if (deps.rateLimit) router.use(createRateLimiter(deps.rateLimit));

  async function resolveSite(place: PlaceQuery): Promise<Site> {
    if (place.site) {
      const site = await deps.sitesRepo.get(place.site);
      if (!site) throw notFound(`No site with id "${place.site}".`);
      return site;
    }
    return adhocSite(place.lat!, place.lon!);
  }

  // GET /v1/sites
  router.get('/sites', async (_req, res, next) => {
    try {
      const sites = await deps.sitesRepo.list();
      res.json({
        model: 'smooth Moon',
        source: 'JPL Horizons',
        sites: sites.map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          source: s.source,
          has_terrain: s.hasTerrain,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/sky
  router.get('/sky', async (req: Request, res, next) => {
    try {
      const place = parsePlace(req.query as Record<string, unknown>);
      const date = parseDate(req.query.date);
      const hour = parseInteger(req.query.hour, 'hour', 0, 23, 0);
      const margin = parseNumber(req.query.margin, 'margin', 0, 5, 2);
      const site = await resolveSite(place);

      const span: HorizonsSpan = { start: `${date} 00:00`, stop: `${addDays(date, 1)} 00:00`, step: '1h' };
      const { sun, earth, saved } = await deps.seriesProvider.get(site, span);
      const target = isoAt(date, hour);
      const s = sun.find((r) => r.time === target);
      const e = earth.find((r) => r.time === target);
      if (!s || !e) throw serviceUnavailable('No saved positions for that time.', sun.length > 0 || earth.length > 0);

      const state = stateFor(s.elevationDeg, e.elevationDeg, margin);
      res.json({
        model: 'smooth Moon',
        source: 'JPL Horizons',
        saved,
        scenario: { site: site.id, lat: site.lat, lon: site.lon, date, hour, margin },
        sun: { azimuth_deg: s.azimuthDeg, elevation_deg: s.elevationDeg },
        earth: { azimuth_deg: e.azimuthDeg, elevation_deg: e.elevationDeg },
        state: { word: state.word, symbol: state.symbol, power_up: state.powerUp, link_up: state.linkUp },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/windows
  router.get('/windows', async (req: Request, res, next) => {
    try {
      const place = parsePlace(req.query as Record<string, unknown>);
      const start = parseDate(req.query.start, 'start');
      const days = parseInteger(req.query.days, 'days', 1, 60, 30);
      const margin = parseNumber(req.query.margin, 'margin', 0, 5, 2);
      const site = await resolveSite(place);

      const stopDate = addDays(start, days);
      const span: HorizonsSpan = { start: `${start} 00:00`, stop: `${stopDate} 00:00`, step: '1h' };
      const { sun, earth, saved, complete } = await deps.seriesProvider.get(site, span);

      const startMs = Date.parse(`${start}T00:00:00Z`);
      const stopMs = Date.parse(`${stopDate}T00:00:00Z`);
      const within = (iso: string) => {
        const t = Date.parse(iso);
        return t >= startMs && t < stopMs;
      };
      const sunW = sun.filter((r) => within(r.time));
      const earthW = earth.filter((r) => within(r.time));
      if (sunW.length === 0 || earthW.length === 0) {
        throw serviceUnavailable('No saved positions for that range.', sun.length > 0 || earth.length > 0);
      }

      const earthByTime = new Map(earth.map((r) => [r.time, r]));
      const result = computeResult(sunW, earthW, { marginDeg: margin });
      res.json({
        model: result.model,
        source: 'JPL Horizons',
        saved,
        // True when NASA could not be reached and only part of the span was saved.
        partial: complete === false,
        scenario: { site: site.id, lat: site.lat, lon: site.lon, start, days, margin },
        state: {
          word: result.landing.word,
          symbol: result.landing.symbol,
          power_up: result.landing.powerUp,
          link_up: result.landing.linkUp,
        },
        works: result.works,
        power: serializeSummary(result.power),
        contact: serializeSummary(result.contact),
        // Hourly positions for the span, so a client can scrub and recompute with
        // the same shared calculator when the allowance changes.
        // Includes the closing hour (start + days), which the summaries above do not.
        series: sun
          .filter((r) => {
            const t = Date.parse(r.time);
            return t >= startMs && t <= stopMs;
          })
          .map((sr) => {
            const er = earthByTime.get(sr.time);
            return {
              t: sr.time,
              sun_elev: sr.elevationDeg,
              sun_az: sr.azimuthDeg,
              earth_elev: er?.elevationDeg ?? null,
              earth_az: er?.azimuthDeg ?? null,
            };
          }),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
