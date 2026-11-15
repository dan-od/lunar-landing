// The one calculator behind the API. The v1 routes, the assistant connector (by
// way of the routes) and the watch rules all get their answers from the
// functions made here, so a window, a slip or a miss is never worked out twice
// in two different ways.
import type { Aim, Site } from '@moon/core';
import {
  MAX_AIM_DISTANCE,
  MISS_RADII,
  computeResult,
  missGrid,
  outOfTen,
  ringOdds,
  safestAim,
  stateFor,
} from '@moon/core';
import { ApiError, badRequest, conflict, notFound, serviceUnavailable } from './errors.js';
import { DATE_MAX, DATE_MIN, type PlaceQuery } from './validate.js';
import type { RateLimitOptions } from './rateLimit.js';
import type { SeriesProvider, SiteTerrain, SitesRepo, TerrainRepo } from './providers.js';
import type { HorizonsSpan } from '../horizons/client.js';

export interface CalcDeps {
  sitesRepo: SitesRepo;
  seriesProvider: SeriesProvider;
  /** Prepared terrain. Without it every site is treated as having none. */
  terrainRepo?: TerrainRepo;
  /** How many new custom coordinates a visitor may use per window (2-3). */
  customLimit?: RateLimitOptions;
  /** How many dates not saved yet a visitor may open per window (each costs NASA requests). */
  periodLimit?: RateLimitOptions;
}

export const isoAt = (date: string, hour: number): string => `${date}T${String(hour).padStart(2, '0')}:00:00Z`;

/** Epoch ms to the 'YYYY-MM-DD HH:MM' form Horizons spans use. */
export const spanTime = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

/** A custom point. Its id is its coordinates, so two points never share saved positions. */
function adhocSite(lat: number, lon: number): Site {
  return {
    id: `point:${lat},${lon}`,
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

export interface WindowsQuery {
  /** Who is asking, for the limit on new coordinates. */
  visitor: string;
  place: PlaceQuery;
  start: string;
  hour: number;
  days: number;
  margin: number;
  /** When given, the point's terrain horizon is used instead of the shadow allowance. */
  aim?: Aim;
}

/** The daily watch check: never limited, because no visitor is waiting on it. */
export const SYSTEM_VISITOR = 'watch';

export interface SlipQuery {
  /** Who is asking, for the limit on new dates. */
  visitor?: string;
  site: Site;
  date: string;
  hour: number;
  margin: number;
}

export interface MissQuery {
  /** Who is asking, for the limit on new dates. */
  visitor?: string;
  site: Site;
  date: string;
  hour: number;
  aim: Aim;
  /** The names of the two aim fields, for error replies. */
  eastField?: string;
  northField?: string;
}

export type Calc = ReturnType<typeof createCalc>;

export function createCalc(deps: CalcDeps) {
  // New coordinates cost two NASA requests each, so a visitor may add only a few
  // per hour (2-3). A point the visitor has already used is not counted again.
  const customPoints = new Map<string, { resetAt: number; ids: Set<string> }>();
  function allowCustomPoint(visitor: string, pointId: string): void {
    const limit = deps.customLimit;
    if (!limit) return;
    const now = (limit.now ?? Date.now)();
    let entry = customPoints.get(visitor);
    if (!entry || now >= entry.resetAt) {
      entry = { resetAt: now + limit.windowMs, ids: new Set() };
      customPoints.set(visitor, entry);
    }
    if (entry.ids.has(pointId)) return;
    if (entry.ids.size >= limit.max) {
      const wait = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      throw new ApiError(
        429,
        {
          error: {
            message: `Too many new coordinates. A visitor can add ${limit.max} an hour. Try again in ${wait} seconds.`,
            retryAfterSeconds: wait,
          },
        },
        { 'Retry-After': String(wait) },
      );
    }
    entry.ids.add(pointId);
  }

  // A date not saved yet costs NASA requests, so a visitor may open only a few
  // an hour. One date and hour counts once, however many sites ask for it.
  const newPeriods = new Map<string, { resetAt: number; keys: Set<string> }>();
  function allowNewPeriod(visitor: string, periodKey: string): void {
    const limit = deps.periodLimit;
    if (!limit) return;
    const now = (limit.now ?? Date.now)();
    let entry = newPeriods.get(visitor);
    if (!entry || now >= entry.resetAt) {
      entry = { resetAt: now + limit.windowMs, keys: new Set() };
      newPeriods.set(visitor, entry);
    }
    if (entry.keys.has(periodKey)) return;
    if (entry.keys.size >= limit.max) {
      const wait = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      throw new ApiError(
        429,
        {
          error: {
            message: `Too many new dates. A visitor can open ${limit.max} dates that are not saved yet each hour. Saved dates still work. Try again in ${wait} seconds.`,
            retryAfterSeconds: wait,
          },
        },
        { 'Retry-After': String(wait) },
      );
    }
    entry.keys.add(periodKey);
  }

  /** Positions for a span, counting it against the visitor's new dates only if NASA must be asked. */
  function seriesFor(site: Site, span: HorizonsSpan, visitor?: string) {
    // Custom points have their own hourly limit; the daily watch check is never limited.
    const limited = visitor && visitor !== SYSTEM_VISITOR && !site.custom;
    return deps.seriesProvider.get(
      site,
      span,
      limited ? { beforeFetch: () => allowNewPeriod(visitor, `${span.start}|${span.stop}`) } : undefined,
    );
  }

  async function resolveSite(place: PlaceQuery, visitor: string): Promise<Site> {
    if (place.site) {
      const site = await deps.sitesRepo.get(place.site);
      if (!site) throw notFound(`No site with id "${place.site}".`);
      return site;
    }
    const point = adhocSite(place.lat!, place.lon!);
    allowCustomPoint(visitor, point.id);
    return point;
  }

  /** The prepared terrain for a site, or a 409 that says which sites have terrain. */
  async function terrainFor(site: Site): Promise<SiteTerrain> {
    const terrain = site.custom ? undefined : await deps.terrainRepo?.get(site.id);
    if (terrain) return terrain;
    const withTerrain = (await deps.sitesRepo.list())
      .filter((s) => s.hasTerrain)
      .map((s) => `${s.name} (${s.id})`);
    throw conflict(
      `No terrain is prepared for ${site.name}. ` +
        (withTerrain.length > 0
          ? `Terrain is prepared for: ${withTerrain.join('; ')}.`
          : 'No site has terrain prepared yet.'),
    );
  }

  /** An aim must sit on a prepared grid point within reach of the target. */
  function checkAim(terrain: SiteTerrain, aim: Aim, eastField: string, northField: string): Aim {
    const reach = Math.floor(Math.min(MAX_AIM_DISTANCE, terrain.halfM) / terrain.stepM) * terrain.stepM;
    const allowed = `multiples of ${terrain.stepM} from -${reach} to ${reach}, within ${MAX_AIM_DISTANCE} m of the target`;
    for (const [field, value] of [
      [eastField, aim.east],
      [northField, aim.north],
    ] as const) {
      if (value % terrain.stepM !== 0 || Math.abs(value) > reach) {
        throw badRequest(field, `${field} is not on the prepared terrain grid.`, allowed);
      }
    }
    if (Math.hypot(aim.east, aim.north) > MAX_AIM_DISTANCE) {
      throw badRequest(eastField, 'The aim is too far from the target.', allowed);
    }
    return aim;
  }

  /** One case, computed once by the one calculator. Every window endpoint uses this. */
  async function computeWindows(q: WindowsQuery) {
    const { start, hour, days, margin } = q;
    const site = await resolveSite(q.place, q.visitor);

    const startMs = Date.parse(isoAt(start, hour));
    const stopMs = startMs + days * 86_400_000;
    const span: HorizonsSpan = {
      start: spanTime(startMs),
      stop: spanTime(stopMs),
      step: '1h',
    };
    const { sun, earth, saved, complete } = await seriesFor(site, span, q.visitor);

    const within = (iso: string) => {
      const t = Date.parse(iso);
      return t >= startMs && t < stopMs;
    };
    const sunW = sun.filter((r) => within(r.time));
    const earthW = earth.filter((r) => within(r.time));
    if (sunW.length === 0 || earthW.length === 0) {
      throw serviceUnavailable('No saved positions for that range.', sun.length > 0 || earth.length > 0);
    }
    let horizon: number[] | undefined;
    if (q.aim) {
      const terrain = await terrainFor(site);
      const aim = checkAim(terrain, q.aim, 'aim_east', 'aim_north');
      horizon = terrain.points.find((p) => p.east === aim.east && p.north === aim.north)?.heights;
      if (!horizon) throw badRequest('aim_east', 'That aim is not on the prepared terrain grid.');
    }
    const result = computeResult(sunW, earthW, { marginDeg: margin, horizon });
    return {
      site,
      start,
      hour,
      days,
      margin,
      startMs,
      stopMs,
      sun,
      earth,
      /** The rows inside the span, which the result was computed from. */
      sunInSpan: sunW,
      earthInSpan: earthW,
      saved,
      complete,
      result,
      aim: q.aim,
      horizon,
    };
  }

  /**
   * What if the landing misses? (flow 4). "Works" looks at touchdown and the
   * first 10 days. Real prepared terrain only: a site without profiles gets a
   * 409, never invented ground.
   */
  async function computeMiss(q: MissQuery) {
    const terrain = await terrainFor(q.site);
    const aim = checkAim(terrain, q.aim, q.eastField ?? 'east', q.northField ?? 'north');

    const startMs = Date.parse(isoAt(q.date, q.hour));
    const stopMs = startMs + 10 * 86_400_000;
    const span: HorizonsSpan = {
      start: spanTime(startMs),
      stop: spanTime(stopMs),
      step: '1h',
    };
    const { sun, earth, saved } = await seriesFor(q.site, span, q.visitor);
    const within = (iso: string) => {
      const t = Date.parse(iso);
      return t >= startMs && t < stopMs;
    };
    const sunW = sun.filter((r) => within(r.time));
    const earthW = earth.filter((r) => within(r.time));
    if (sunW.length === 0 || earthW.length === 0) {
      throw serviceUnavailable('No saved positions for that range.', sun.length > 0 || earth.length > 0);
    }

    const grid = missGrid(sunW, earthW, terrain.points);
    const odds = MISS_RADII.map((radius) => {
      const o = ringOdds(grid, aim, radius, terrain.stepM);
      return {
        accuracy_m: radius,
        share: o.share,
        out_of_10: outOfTen(o.share),
        working: o.working,
        points: o.points,
        // 1 when the whole ring lies inside the prepared terrain.
        coverage: o.coverage,
      };
    });
    return {
      terrain,
      aim,
      saved,
      grid,
      odds,
      /** The safest aim for a lander accuracy, in metres. */
      safest: (accuracy: number) => safestAim(grid, accuracy, terrain.stepM),
    };
  }

  /**
   * Ready or not ready for each whole-day slip of the landing date, from 30 days
   * earlier to 30 days later (7-5). A slip with no saved positions is reported
   * as unknown, never guessed.
   */
  async function computeSlip(q: SlipQuery) {
    const landingMs = Date.parse(isoAt(q.date, q.hour));
    const moments: Array<{ slip: number; ms: number; date: string }> = [];
    for (let slip = -30; slip <= 30; slip++) {
      const ms = landingMs + slip * 86_400_000;
      const d = new Date(ms).toISOString().slice(0, 10);
      if (d >= DATE_MIN && d <= DATE_MAX) moments.push({ slip, ms, date: d });
    }
    const span: HorizonsSpan = {
      start: spanTime(moments[0]!.ms),
      stop: spanTime(moments[moments.length - 1]!.ms),
      step: '1h',
    };
    const { sun, earth, saved } = await seriesFor(q.site, span, q.visitor);
    const sunAt = new Map(sun.map((r) => [Date.parse(r.time), r]));
    const earthAt = new Map(earth.map((r) => [Date.parse(r.time), r]));

    const slips = moments.map((m) => {
      const s = sunAt.get(m.ms);
      const e = earthAt.get(m.ms);
      if (!s || !e) return { slip_days: m.slip, date: m.date, ready: null, word: null, symbol: null };
      const state = stateFor(s.elevationDeg, e.elevationDeg, q.margin);
      return {
        slip_days: m.slip,
        date: m.date,
        ready: state.word === 'READY',
        word: state.word,
        symbol: state.symbol,
      };
    });
    const known = slips.filter((x) => x.ready !== null).length;
    if (known === 0) throw serviceUnavailable('No saved positions for those dates.', false);

    // Slip-proof: ready at every slip from 0 to 14 days. Unknown if any of those is unknown.
    const forward = slips.filter((x) => x.slip_days >= 0 && x.slip_days <= 14);
    const slipProof = forward.some((x) => x.ready === false)
      ? false
      : forward.length === 15 && forward.every((x) => x.ready === true)
        ? true
        : null;

    return { saved, known, slipProof, slips };
  }

  return { resolveSite, terrainFor, checkAim, computeWindows, computeMiss, computeSlip, seriesFor };
}
