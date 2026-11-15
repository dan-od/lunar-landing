// The v1 API: /v1/sites, /v1/sky, /v1/windows. Pages and the (later) assistant
// connector read these, so there is one source of answers. Every reply names the
// scenario and the model used.
import { Router, type Request } from 'express';
import type { Aim, BodySummary } from '@moon/core';
import { CHANGE_LABELS, MISS_RADII, aimText, buildIcs, buildReport, changesFrom, csvRow, outOfTen, stateFor, type ChangeKind } from '@moon/core';
import { badRequest, notFound, serviceUnavailable } from './errors.js';
import { config } from '../config.js';
import { parseDate, parseInteger, parseNumber, parsePlace } from './validate.js';
import { createRateLimiter, type RateLimitOptions } from './rateLimit.js';
import { createCalc, isoAt, spanTime, type CalcDeps, type WindowsQuery } from './calc.js';
import { createWatchRouter, type WatchDeps } from '../watch/routes.js';
import type { HorizonsSpan } from '../horizons/client.js';

export interface V1Deps extends CalcDeps {
  rateLimit?: RateLimitOptions;
  /** Email alerts (flow 5). Left out, the watch endpoints say they are switched off. */
  watch?: WatchDeps;
}

const addDays = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Byte-order mark, so spreadsheet apps read the file as UTF-8. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** Epoch ms to 'YYYY-MM-DD HH:MM' (UTC), which spreadsheet apps read as a date and time. */
const sheetTime = spanTime;

function serializeSummary(s: BodySummary) {
  return {
    uptime_pct: s.uptimePct,
    longest_gap_days: s.longestGapDays,
    next_change_hours: s.nextChangeHours,
    windows: s.windows.map((w) => ({
      start: w.start,
      end: w.end,
      hours: w.hours,
    })),
  };
}

export function createV1Router(deps: V1Deps): Router {
  const router = Router();
  if (deps.rateLimit) router.use(createRateLimiter(deps.rateLimit));

  // The one calculator: these routes and the watch rules share it.
  const calc = createCalc(deps);
  const { resolveSite, terrainFor, computeWindows } = calc;

  const visitorOf = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';

  // Email alerts (flow 5). Mounted even when switched off, so the page can ask.
  router.use('/watches', createWatchRouter(calc, deps.sitesRepo, deps.watch));

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
      const site = await resolveSite(place, visitorOf(req));

      const span: HorizonsSpan = {
        start: `${date} 00:00`,
        stop: `${addDays(date, 1)} 00:00`,
        step: '1h',
      };
      const { sun, earth, saved } = await calc.seriesFor(site, span, visitorOf(req));
      const target = isoAt(date, hour);
      const s = sun.find((r) => r.time === target);
      const e = earth.find((r) => r.time === target);
      if (!s || !e)
        throw serviceUnavailable('No saved positions for that time.', sun.length > 0 || earth.length > 0);

      const state = stateFor(s.elevationDeg, e.elevationDeg, margin);
      res.json({
        model: 'smooth Moon',
        source: 'JPL Horizons',
        saved,
        scenario: {
          site: site.id,
          lat: site.lat,
          lon: site.lon,
          date,
          hour,
          margin,
        },
        sun: { azimuth_deg: s.azimuthDeg, elevation_deg: s.elevationDeg },
        earth: { azimuth_deg: e.azimuthDeg, elevation_deg: e.elevationDeg },
        state: {
          word: state.word,
          symbol: state.symbol,
          power_up: state.powerUp,
          link_up: state.linkUp,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** aim_east and aim_north come together or not at all. */
  function parseAimPair(query: Record<string, unknown>): Aim | undefined {
    const has = (k: string) => query[k] !== undefined && query[k] !== '';
    if (!has('aim_east') && !has('aim_north')) return undefined;
    return {
      east: parseInteger(query.aim_east, 'aim_east', -1000, 1000),
      north: parseInteger(query.aim_north, 'aim_north', -1000, 1000),
    };
  }

  function loadWindows(req: Request) {
    return computeWindows({
      visitor: visitorOf(req),
      place: parsePlace(req.query as Record<string, unknown>),
      start: parseDate(req.query.start, 'start'),
      hour: parseInteger(req.query.hour, 'hour', 0, 23, 0),
      days: parseInteger(req.query.days, 'days', 1, 60, 30),
      margin: parseNumber(req.query.margin, 'margin', 0, 5, 2),
      aim: parseAimPair(req.query as Record<string, unknown>),
    });
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
          ...(w.aim ? { aim: w.aim } : {}),
        },
        // Present only for an aim point: the terrain horizon that replaced the allowance.
        ...(w.horizon ? { horizon: w.horizon } : {}),
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

  // GET /v1/windows.ics: the upcoming changes (sunrise, sunset, Earth rise,
  // Earth set) as a calendar file with a reminder on each (6-2, the Watch tab).
  // With at and kind, just that one change. Read from the same windows as above.
  router.get('/windows.ics', async (req: Request, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const remind = parseInteger(query.remind, 'remind', 0, 1440, 60);
      let only: { at: number; kind: ChangeKind } | undefined;
      if (query.at !== undefined || query.kind !== undefined) {
        const kind = String(query.kind ?? '') as ChangeKind;
        if (!(kind in CHANGE_LABELS)) {
          throw badRequest('kind', 'kind must name one change.', 'sunrise, sunset, earthrise or earthset');
        }
        const at = Date.parse(String(query.at ?? ''));
        if (Number.isNaN(at)) throw badRequest('at', 'at must be a UTC time such as 2025-03-06T17:00:00Z.');
        only = { at, kind };
      }
      const w = await loadWindows(req);
      const { site, result } = w;
      let changes = changesFrom(result, new Date(w.startMs).toISOString(), w.days * 24);
      if (only) {
        changes = changes.filter((c) => c.kind === only.kind && Date.parse(c.time) === only.at);
        if (changes.length === 0) throw notFound('No change of that kind at that time for this landing.');
      }
      const model = w.aim
        ? `Terrain model: the horizon at the aim point (${aimText(w.aim)}), from the LOLA elevation map.`
        : `Smooth-Moon model with a ${w.margin}° shadow allowance; hills are not counted.`;
      const landing = sheetTime(w.startMs);
      const link = `${config.publicSiteUrl}/watch?site=${encodeURIComponent(site.id)}&date=${w.start}&hour=${w.hour}&margin=${w.margin}`;
      const fileId = site.id.replace(/[^A-Za-z0-9_-]+/g, '-');
      const ics = buildIcs({
        name: `Moon Status: ${site.name}`,
        events: changes.map((c) => ({
          uid: `${c.kind}-${c.time.replace(/[-:]/g, '')}-${fileId}-${w.start}-${w.hour}@moon-status`,
          start: c.time,
          minutes: 60,
          summary: `${c.label} at ${site.name}`,
          description:
            `${c.label} at ${site.name}, ${c.hoursAfterLanding} hours after a landing at ${landing} UTC. ` +
            `${model} Positions from NASA JPL Horizons, hourly, so the time is to the hour.\n${link}`,
          alarmMinutesBefore: remind,
        })),
      });
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="moon-status-${only ? only.kind : 'changes'}-${fileId}-${w.start}.ics"`,
      );
      res.send(ics);
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
        ...(w.aim
          ? [
              csvRow(['Aim', aimText(w.aim)]),
              csvRow(['Horizon', 'terrain at the aim point (shadow allowance not used)']),
            ]
          : [csvRow(['Shadow allowance (degrees)', w.margin])]),
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
            csvRow([
              site.name,
              kind,
              sheetTime(Date.parse(win.start)),
              sheetTime(Date.parse(win.end)),
              win.hours,
            ]),
          );
        }
      }

      const fileId = site.id.replace(/[^A-Za-z0-9_-]+/g, '-');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="moon-status-windows-${fileId}-${w.start}.csv"`,
      );
      // Byte-order mark so spreadsheet apps read the file as UTF-8.
      res.send(`${UTF8_BOM}${lines.join('\r\n')}\r\n`);
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/miss — what if the landing misses? (flow 4). Real prepared terrain
  // only: a site without profiles gets a 409, never invented ground.
  router.get('/miss', async (req: Request, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const site = await resolveSite(parsePlace(query), visitorOf(req));
      const date = parseDate(query.date);
      const hour = parseInteger(query.hour, 'hour', 0, 23, 0);
      const accuracy = parseInteger(query.accuracy, 'accuracy', 0, 100_000, 250);
      if (!MISS_RADII.includes(accuracy)) {
        throw badRequest(
          'accuracy',
          'accuracy must be one of the three lander accuracies.',
          '100, 250 or 320',
        );
      }
      // Asked first, so a site without terrain is told so before anything else.
      await terrainFor(site);
      const miss = await calc.computeMiss({
        visitor: visitorOf(req),
        site,
        date,
        hour,
        aim: {
          east: parseInteger(query.east, 'east', -1000, 1000, 0),
          north: parseInteger(query.north, 'north', -1000, 1000, 0),
        },
      });
      const { terrain, aim, saved, grid } = miss;
      const best = miss.safest(accuracy);
      res.json({
        model: 'terrain',
        source: 'JPL Horizons positions; LOLA south pole elevation map (LDEM_80S_80MPP_ADJ)',
        saved,
        scenario: {
          site: site.id,
          lat: site.lat,
          lon: site.lon,
          date,
          hour,
          aim,
          accuracy,
        },
        aim_text: aimText(aim),
        odds: miss.odds,
        safest: {
          east: best.east,
          north: best.north,
          share: best.share,
          out_of_10: outOfTen(best.share),
          text: aimText(best),
        },
        // Every prepared point: [metres east, metres north, 1 if a landing there works].
        grid: {
          step_m: terrain.stepM,
          half_m: terrain.halfM,
          points: grid.map((p) => [p.east, p.north, p.works ? 1 : 0]),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/slip — ready or not ready for each whole-day slip of the landing date,
  // from 30 days earlier to 30 days later (7-5). A slip with no saved positions
  // is reported as unknown, never guessed.
  router.get('/slip', async (req: Request, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const site = await resolveSite(parsePlace(query), visitorOf(req));
      const date = parseDate(query.date);
      const hour = parseInteger(query.hour, 'hour', 0, 23, 0);
      const margin = parseNumber(query.margin, 'margin', 0, 5, 2);

      const { saved, known, slipProof, slips } = await calc.computeSlip({ visitor: visitorOf(req), site, date, hour, margin });

      res.json({
        model: 'smooth Moon',
        source: 'JPL Horizons',
        saved,
        scenario: { site: site.id, lat: site.lat, lon: site.lon, date, hour, margin },
        known,
        slip_proof_0_to_14: slipProof,
        slips,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/report — the change report between two cases (flow 3). The sentences
  // are built from the same calculator results the two sides would show.
  router.get('/report', async (req: Request, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const days = parseInteger(query.days, 'days', 1, 60, 30);
      const margin = parseNumber(query.margin, 'margin', 0, 5, 2);
      const side = (prefix: 'a_' | 'b_'): WindowsQuery => ({
        visitor: visitorOf(req),
        place: parsePlace(query, prefix),
        start: parseDate(query[`${prefix}date`], `${prefix}date`),
        hour: parseInteger(query[`${prefix}hour`], `${prefix}hour`, 0, 23, 0),
        days,
        margin,
      });
      // Validate both sides before fetching anything.
      const qa = side('a_');
      const qb = side('b_');
      const a = await computeWindows(qa);
      const b = await computeWindows(qb);
      const report = buildReport(a.result, b.result);

      const sideReply = (w: typeof a) => ({
        state: {
          word: w.result.landing.word,
          symbol: w.result.landing.symbol,
          power_up: w.result.landing.powerUp,
          link_up: w.result.landing.linkUp,
        },
        works: w.result.works,
        power: serializeSummary(w.result.power),
        contact: serializeSummary(w.result.contact),
      });
      const sideScenario = (w: typeof a) => ({
        site: w.site.id,
        lat: w.site.lat,
        lon: w.site.lon,
        date: w.start,
        hour: w.hour,
      });

      res.json({
        model: a.result.model,
        source: 'JPL Horizons',
        saved: a.saved && b.saved,
        scenario: { a: sideScenario(a), b: sideScenario(b), days, margin },
        verdict: report.verdict,
        note: report.note,
        same: report.same,
        lines: report.lines,
        a: sideReply(a),
        b: sideReply(b),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
