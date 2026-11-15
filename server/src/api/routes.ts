// The v1 API: /v1/sites, /v1/sky, /v1/windows. Pages and the (later) assistant
// connector read these, so there is one source of answers. Every reply names the
// scenario and the model used.
import { Router, type Request } from "express";
import type { Aim, BodySummary, Site } from "@moon/core";
import {
  MAX_AIM_DISTANCE,
  MISS_RADII,
  aimText,
  buildReport,
  computeResult,
  csvRow,
  missGrid,
  outOfTen,
  ringOdds,
  safestAim,
  stateFor,
} from "@moon/core";
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from "./errors.js";
import {
  parseDate,
  parseInteger,
  parseNumber,
  parsePlace,
  type PlaceQuery,
} from "./validate.js";
import { createRateLimiter, type RateLimitOptions } from "./rateLimit.js";
import type {
  SeriesProvider,
  SiteTerrain,
  SitesRepo,
  TerrainRepo,
} from "./providers.js";
import type { HorizonsSpan } from "../horizons/client.js";

export interface V1Deps {
  sitesRepo: SitesRepo;
  seriesProvider: SeriesProvider;
  /** Prepared terrain. Without it every site is treated as having none. */
  terrainRepo?: TerrainRepo;
  rateLimit?: RateLimitOptions;
}

const addDays = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

const isoAt = (date: string, hour: number): string =>
  `${date}T${String(hour).padStart(2, "0")}:00:00Z`;

/** Byte-order mark, so spreadsheet apps read the file as UTF-8. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** Epoch ms to the 'YYYY-MM-DD HH:MM' form Horizons spans use. */
const spanTime = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 16).replace("T", " ");

/** Epoch ms to 'YYYY-MM-DD HH:MM' (UTC), which spreadsheet apps read as a date and time. */
const sheetTime = spanTime;

function adhocSite(lat: number, lon: number): Site {
  return {
    id: "point",
    name: `Custom point ${lat}, ${lon}`,
    short: "Custom",
    lat,
    lon,
    heightKm: 0,
    source: "(custom point)",
    hasTerrain: false,
    custom: true,
  };
}

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

  async function resolveSite(place: PlaceQuery): Promise<Site> {
    if (place.site) {
      const site = await deps.sitesRepo.get(place.site);
      if (!site) throw notFound(`No site with id "${place.site}".`);
      return site;
    }
    return adhocSite(place.lat!, place.lon!);
  }

  // GET /v1/sites
  router.get("/sites", async (_req, res, next) => {
    try {
      const sites = await deps.sitesRepo.list();
      res.json({
        model: "smooth Moon",
        source: "JPL Horizons",
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
  router.get("/sky", async (req: Request, res, next) => {
    try {
      const place = parsePlace(req.query as Record<string, unknown>);
      const date = parseDate(req.query.date);
      const hour = parseInteger(req.query.hour, "hour", 0, 23, 0);
      const margin = parseNumber(req.query.margin, "margin", 0, 5, 2);
      const site = await resolveSite(place);

      const span: HorizonsSpan = {
        start: `${date} 00:00`,
        stop: `${addDays(date, 1)} 00:00`,
        step: "1h",
      };
      const { sun, earth, saved } = await deps.seriesProvider.get(site, span);
      const target = isoAt(date, hour);
      const s = sun.find((r) => r.time === target);
      const e = earth.find((r) => r.time === target);
      if (!s || !e)
        throw serviceUnavailable(
          "No saved positions for that time.",
          sun.length > 0 || earth.length > 0,
        );

      const state = stateFor(s.elevationDeg, e.elevationDeg, margin);
      res.json({
        model: "smooth Moon",
        source: "JPL Horizons",
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

  /** The prepared terrain for a site, or a 409 that says which sites have terrain. */
  async function terrainFor(site: Site): Promise<SiteTerrain> {
    const terrain = site.custom
      ? undefined
      : await deps.terrainRepo?.get(site.id);
    if (terrain) return terrain;
    const withTerrain = (await deps.sitesRepo.list())
      .filter((s) => s.hasTerrain)
      .map((s) => `${s.name} (${s.id})`);
    throw conflict(
      `No terrain is prepared for ${site.name}. ` +
        (withTerrain.length > 0
          ? `Terrain is prepared for: ${withTerrain.join("; ")}.`
          : "No site has terrain prepared yet."),
    );
  }

  /** An aim must sit on a prepared grid point within reach of the target. */
  function checkAim(
    terrain: SiteTerrain,
    aim: Aim,
    eastField: string,
    northField: string,
  ): Aim {
    const reach =
      Math.floor(Math.min(MAX_AIM_DISTANCE, terrain.halfM) / terrain.stepM) *
      terrain.stepM;
    const allowed = `multiples of ${terrain.stepM} from -${reach} to ${reach}, within ${MAX_AIM_DISTANCE} m of the target`;
    for (const [field, value] of [
      [eastField, aim.east],
      [northField, aim.north],
    ] as const) {
      if (value % terrain.stepM !== 0 || Math.abs(value) > reach) {
        throw badRequest(
          field,
          `${field} is not on the prepared terrain grid.`,
          allowed,
        );
      }
    }
    if (Math.hypot(aim.east, aim.north) > MAX_AIM_DISTANCE) {
      throw badRequest(
        eastField,
        "The aim is too far from the target.",
        allowed,
      );
    }
    return aim;
  }

  interface WindowsQuery {
    place: PlaceQuery;
    start: string;
    hour: number;
    days: number;
    margin: number;
    /** When given, the point's terrain horizon is used instead of the shadow allowance. */
    aim?: Aim;
  }

  /** One case, computed once by the one calculator. Every window endpoint uses this. */
  async function computeWindows(q: WindowsQuery) {
    const { start, hour, days, margin } = q;
    const site = await resolveSite(q.place);

    const startMs = Date.parse(isoAt(start, hour));
    const stopMs = startMs + days * 86_400_000;
    const span: HorizonsSpan = {
      start: spanTime(startMs),
      stop: spanTime(stopMs),
      step: "1h",
    };
    const { sun, earth, saved, complete } = await deps.seriesProvider.get(
      site,
      span,
    );

    const within = (iso: string) => {
      const t = Date.parse(iso);
      return t >= startMs && t < stopMs;
    };
    const sunW = sun.filter((r) => within(r.time));
    const earthW = earth.filter((r) => within(r.time));
    if (sunW.length === 0 || earthW.length === 0) {
      throw serviceUnavailable(
        "No saved positions for that range.",
        sun.length > 0 || earth.length > 0,
      );
    }
    let horizon: number[] | undefined;
    if (q.aim) {
      const terrain = await terrainFor(site);
      const aim = checkAim(terrain, q.aim, "aim_east", "aim_north");
      horizon = terrain.points.find(
        (p) => p.east === aim.east && p.north === aim.north,
      )?.heights;
      if (!horizon)
        throw badRequest(
          "aim_east",
          "That aim is not on the prepared terrain grid.",
        );
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
      saved,
      complete,
      result,
      aim: q.aim,
      horizon,
    };
  }

  /** aim_east and aim_north come together or not at all. */
  function parseAimPair(query: Record<string, unknown>): Aim | undefined {
    const has = (k: string) => query[k] !== undefined && query[k] !== "";
    if (!has("aim_east") && !has("aim_north")) return undefined;
    return {
      east: parseInteger(query.aim_east, "aim_east", -1000, 1000),
      north: parseInteger(query.aim_north, "aim_north", -1000, 1000),
    };
  }

  function loadWindows(req: Request) {
    return computeWindows({
      place: parsePlace(req.query as Record<string, unknown>),
      start: parseDate(req.query.start, "start"),
      hour: parseInteger(req.query.hour, "hour", 0, 23, 0),
      days: parseInteger(req.query.days, "days", 1, 60, 30),
      margin: parseNumber(req.query.margin, "margin", 0, 5, 2),
      aim: parseAimPair(req.query as Record<string, unknown>),
    });
  }

  // GET /v1/windows
  router.get("/windows", async (req: Request, res, next) => {
    try {
      const w = await loadWindows(req);
      const { site, result } = w;
      const earthByTime = new Map(w.earth.map((r) => [r.time, r]));
      res.json({
        model: result.model,
        source: "JPL Horizons",
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

  // GET /v1/windows.csv — the same windows as a spreadsheet file (6-1). One row
  // per window; the first lines state the scenario and the model used.
  router.get("/windows.csv", async (req: Request, res, next) => {
    try {
      const w = await loadWindows(req);
      const { site, result } = w;
      const total = result.power.windows.length + result.contact.windows.length;
      const lines: string[] = [
        csvRow(["Moon Status", "Power and contact windows"]),
        csvRow(["Site", site.name]),
        csvRow(["Latitude", site.lat]),
        csvRow(["Longitude (east)", site.lon]),
        csvRow(["Landing (UTC)", sheetTime(w.startMs)]),
        csvRow(["Days", w.days]),
        ...(w.aim
          ? [
              csvRow(["Aim", aimText(w.aim)]),
              csvRow([
                "Horizon",
                "terrain at the aim point (shadow allowance not used)",
              ]),
            ]
          : [csvRow(["Shadow allowance (degrees)", w.margin])]),
        csvRow(["Model", result.model]),
        csvRow([
          "Source",
          "NASA JPL Horizons, hourly positions of the centre of the Sun and Earth",
        ]),
        csvRow(["Windows", total]),
        "",
        csvRow(["site", "kind", "start_utc", "end_utc", "length_hours"]),
      ];
      for (const [kind, summary] of [
        ["power", result.power],
        ["contact", result.contact],
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

      const fileId = site.id.replace(/[^A-Za-z0-9_-]+/g, "-");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="moon-status-windows-${fileId}-${w.start}.csv"`,
      );
      // Byte-order mark so spreadsheet apps read the file as UTF-8.
      res.send(`${UTF8_BOM}${lines.join("\r\n")}\r\n`);
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/miss — what if the landing misses? (flow 4). Real prepared terrain
  // only: a site without profiles gets a 409, never invented ground.
  router.get("/miss", async (req: Request, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const site = await resolveSite(parsePlace(query));
      const date = parseDate(query.date);
      const hour = parseInteger(query.hour, "hour", 0, 23, 0);
      const accuracy = parseInteger(
        query.accuracy,
        "accuracy",
        0,
        100_000,
        250,
      );
      if (!MISS_RADII.includes(accuracy)) {
        throw badRequest(
          "accuracy",
          "accuracy must be one of the three lander accuracies.",
          "100, 250 or 320",
        );
      }
      const terrain = await terrainFor(site);
      const aim = checkAim(
        terrain,
        {
          east: parseInteger(query.east, "east", -1000, 1000, 0),
          north: parseInteger(query.north, "north", -1000, 1000, 0),
        },
        "east",
        "north",
      );

      // "Works" looks at touchdown and the first 10 days.
      const startMs = Date.parse(isoAt(date, hour));
      const stopMs = startMs + 10 * 86_400_000;
      const span: HorizonsSpan = {
        start: spanTime(startMs),
        stop: spanTime(stopMs),
        step: "1h",
      };
      const { sun, earth, saved } = await deps.seriesProvider.get(site, span);
      const within = (iso: string) => {
        const t = Date.parse(iso);
        return t >= startMs && t < stopMs;
      };
      const sunW = sun.filter((r) => within(r.time));
      const earthW = earth.filter((r) => within(r.time));
      if (sunW.length === 0 || earthW.length === 0) {
        throw serviceUnavailable(
          "No saved positions for that range.",
          sun.length > 0 || earth.length > 0,
        );
      }

      const grid = missGrid(sunW, earthW, terrain.points);
      const best = safestAim(grid, accuracy, terrain.stepM);
      res.json({
        model: "terrain",
        source:
          "JPL Horizons positions; LOLA south pole elevation map (LDEM_80S_80MPP_ADJ)",
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
        odds: MISS_RADII.map((radius) => {
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
        }),
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

  // GET /v1/report — the change report between two cases (flow 3). The sentences
  // are built from the same calculator results the two sides would show.
  router.get("/report", async (req: Request, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const days = parseInteger(query.days, "days", 1, 60, 30);
      const margin = parseNumber(query.margin, "margin", 0, 5, 2);
      const side = (prefix: "a_" | "b_"): WindowsQuery => ({
        place: parsePlace(query, prefix),
        start: parseDate(query[`${prefix}date`], `${prefix}date`),
        hour: parseInteger(query[`${prefix}hour`], `${prefix}hour`, 0, 23, 0),
        days,
        margin,
      });
      // Validate both sides before fetching anything.
      const qa = side("a_");
      const qb = side("b_");
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
        source: "JPL Horizons",
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
