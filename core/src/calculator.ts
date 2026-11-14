// THE one window calculator. Pages, exported files, the API and the assistant
// connector all call this, so numbers can never disagree (AGENTS.md).
//
// Inputs are hourly position series (Sun and Earth) as returned by NASA Horizons.
// A body "counts" when its elevation is strictly above the shadow allowance.
import type {
  PositionRow,
  SiteState,
  BodySummary,
  Window,
  WindowResult,
  ModelName,
} from './types.js';
import { clampMargin } from './direction.js';

const HOURS_PER_DAY = 24;
/** "Works" looks at the first 10 days (the planned 2025 surface mission). */
const WORKS_WINDOW_HOURS = 10 * HOURS_PER_DAY;
/** A landing works if it is ready at touchdown and for at least this share of 10 days. */
const WORKS_THRESHOLD = 0.9;

/** The state at a single moment from the two elevations and the allowance. */
export function stateFor(sunElevDeg: number, earthElevDeg: number, marginDeg: number): SiteState {
  const m = clampMargin(marginDeg);
  const powerUp = sunElevDeg > m;
  const linkUp = earthElevDeg > m;
  if (powerUp && linkUp) return { word: 'READY', symbol: '●', powerUp, linkUp };
  if (!powerUp && !linkUp) return { word: 'DARK, NO LINK', symbol: '✕', powerUp, linkUp };
  if (!powerUp) return { word: 'NO POWER', symbol: '▲', powerUp, linkUp };
  return { word: 'NO LINK', symbol: '■', powerUp, linkUp };
}

/** Infer the hourly step (in hours) from the first two rows; default 1. */
function stepHours(rows: PositionRow[]): number {
  if (rows.length < 2) return 1;
  const a = Date.parse(rows[0]!.time);
  const b = Date.parse(rows[1]!.time);
  const h = Math.abs(b - a) / 3_600_000;
  return h > 0 ? h : 1;
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString().replace('.000Z', 'Z');
}

/**
 * Summarise one body's series against the allowance: uptime, the longest gap,
 * the time to the next change from the first row, and the "up" windows.
 */
export function summarizeSeries(rows: PositionRow[], marginDeg: number): BodySummary {
  const m = clampMargin(marginDeg);
  const n = rows.length;
  const step = stepHours(rows);
  const up = rows.map((r) => r.elevationDeg > m);

  const upCount = up.filter(Boolean).length;
  const uptimePct = n === 0 ? 0 : Math.round((100 * upCount) / n);

  // Longest run of "down" samples, measured as sampleCount * step.
  let longestDownRun = 0;
  let run = 0;
  for (const isUp of up) {
    run = isUp ? 0 : run + 1;
    if (run > longestDownRun) longestDownRun = run;
  }
  const longestGapDays = (longestDownRun * step) / HOURS_PER_DAY;

  // Hours from the landing moment to the first change.
  let nextChangeHours: number | null = null;
  for (let j = 1; j < n; j++) {
    if (up[j] !== up[0]) {
      nextChangeHours = j * step;
      break;
    }
  }

  // Contiguous "up" windows.
  const windows: Window[] = [];
  let a = -1;
  for (let i = 0; i < n; i++) {
    if (up[i] && a < 0) a = i;
    const atEnd = i === n - 1;
    if (a >= 0 && (!up[i] || atEnd)) {
      const last = up[i] ? i : i - 1;
      const count = last - a + 1;
      const hours = count * step;
      windows.push({ start: rows[a]!.time, end: addHours(rows[a]!.time, hours), hours });
      a = -1;
    }
  }

  return { uptimePct, longestGapDays, nextChangeHours, windows };
}

/**
 * The full result for a scenario over a span. `sun` and `earth` must be the same
 * hourly timestamps in order.
 */
export function computeResult(
  sun: PositionRow[],
  earth: PositionRow[],
  opts: { marginDeg: number; model?: ModelName },
): WindowResult {
  const marginDeg = clampMargin(opts.marginDeg);
  const model: ModelName = opts.model ?? 'smooth Moon';
  const n = Math.min(sun.length, earth.length);

  const landing =
    n > 0
      ? stateFor(sun[0]!.elevationDeg, earth[0]!.elevationDeg, marginDeg)
      : { word: 'DARK, NO LINK' as const, symbol: '✕', powerUp: false, linkUp: false };

  // "Works": ready at touchdown and ready for >=90% of the first 10 days.
  const step = n > 1 ? stepHours(sun) : 1;
  const horizonSamples = Math.min(n, Math.ceil(WORKS_WINDOW_HOURS / step));
  let readyCount = 0;
  for (let i = 0; i < horizonSamples; i++) {
    const ready = sun[i]!.elevationDeg > marginDeg && earth[i]!.elevationDeg > marginDeg;
    if (ready) readyCount++;
  }
  const readyShare = horizonSamples === 0 ? 0 : readyCount / horizonSamples;
  const works = landing.powerUp && landing.linkUp && readyShare >= WORKS_THRESHOLD;

  return {
    model,
    power: summarizeSeries(sun, marginDeg),
    contact: summarizeSeries(earth, marginDeg),
    landing,
    works,
  };
}
