// The v1 API: /v1/sites, /v1/sky, /v1/windows. Pages and the (later) assistant
// connector read these, so there is one source of answers. Every reply names the
// scenario and the model used.
import { Router, type Request } from 'express';
import type { BodySummary, Site } from '@moon/core';
import { computeResult, csvRow, stateFor } from '@moon/core';
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

/** Byte-order mark, so spreadsheet apps read the file as UTF-8. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** Epoch ms to the 'YYYY-MM-DD HH:MM' form Horizons spans use. */
const spanTime = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

/** Epoch ms to 'YYYY-MM-DD HH:MM' (UTC), which spreadsheet apps read as a date and time. */
const sheetTime = spanTime;

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

  /** Everything both window endpoints need, computed once by the one calculator. */
  async function loadWindows(req: Request) {
    const place = parsePlace(req.query as Record<string, unknown>);
    const start = parseDate(req.query.start, 'start');
    const hour = parseInteger(req.query.hour, 'hour', 0, 23, 0);
    const days = parseInteger(req.query.days, 'days', 1, 60, 30);
    const margin = parseNumber(req.query.margin, 'margin', 0, 5, 2);
    const site = await resolveSite(place);

    const startMs = Date.parse(isoAt(start, hour));
    const stopMs = startMs + days * 86_400_000;
    const span: HorizonsSpan = { start: spanTime(startMs), stop: spanTime(stopMs), step: '1h' };
    const { sun, earth, saved, complete } = await deps.seriesProvider.get(site, span);

    const within = (iso: string) => {
      const t = Date.parse(iso);
      return t >= startMs && t < stopMs;
    };
    const sunW = sun.filter((r) => within(r.time));
    const earthW = earth.filter((r) => within(r.time));
    if (sunW.length === 0 || earthW.length === 0) {
      throw serviceUnavailable('No saved positions for that range.', sun.length > 0 || earth.length > 0);
    }
    const result = computeResult(sunW, earthW, { marginDeg: margin });
    return { site, start, hour, days, margin, startMs, stopMs, sun, earth, saved, complete, result };
  }

  // GET /v1/windows
  router.get('/windows', async (req: Request, res, next) => {
    try {
      const w = await loadWindows(req);
      const { site, result } = w;
      const earthByTime = new Map(w.earth.map((r) => [r.time, r]));
      res.json({
        model: result.model,
        source: 'JPL Horizons',
        saved: w.saved,
        // True when NASA could not be reached and only part of the span was saved.
        partial: w.complete === false,
        scenario: {
          site: site.id,
          lat: site.lat,
          lon: site.lon,
          start: w.start,
          hour: w.hour,
          days: w.days,
          margin: w.margin,
        },
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
        series: w.sun
          .filter((r) => {
            const t = Date.parse(r.time);
            return t >= w.startMs && t <= w.stopMs;
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

  // GET /v1/windows.csv — the same windows as a spreadsheet file (6-1). One row
  // per window; the first lines state the scenario and the model used.
  router.get('/windows.csv', async (req: Request, res, next) => {
    try {
      const w = await loadWindows(req);
      const { site, result } = w;
      const total = result.power.windows.length + result.contact.windows.length;
      const lines: string[] = [
        csvRow(['Moon Status', 'Power and contact windows']),
        csvRow(['Site', site.name]),
        csvRow(['Latitude', site.lat]),
        csvRow(['Longitude (east)', site.lon]),
        csvRow(['Landing (UTC)', sheetTime(w.startMs)]),
        csvRow(['Days', w.days]),
        csvRow(['Shadow allowance (degrees)', w.margin]),
        csvRow(['Model', result.model]),
        csvRow(['Source', 'NASA JPL Horizons, hourly positions of the centre of the Sun and Earth']),
        csvRow(['Windows', total]),
        '',
        csvRow(['site', 'kind', 'start_utc', 'end_utc', 'length_hours']),
      ];
      for (const [kind, summary] of [
        ['power', result.power],
        ['contact', result.contact],
      ] as const) {
        for (const win of summary.windows) {
          lines.push(
            csvRow([site.name, kind, sheetTime(Date.parse(win.start)), sheetTime(Date.parse(win.end)), win.hours]),
          );
        }
      }

      const fileId = site.id.replace(/[^A-Za-z0-9_-]+/g, '-');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="moon-status-windows-${fileId}-${w.start}.csv"`);
      // Byte-order mark so spreadsheet apps read the file as UTF-8.
      res.send(`${UTF8_BOM}${lines.join('\r\n')}\r\n`);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
