// The shared scenario lives in the page address so tabs, links and exports agree
// (1-6). Unknown or out-of-range values fall back to a default and say why; they
// never fail (contract rule 2, 1-13).

export interface Scenario {
  site: string;
  /** Landing date, YYYY-MM-DD (UTC). */
  date: string;
  /** Landing hour (UTC), 0..23. */
  hour: number;
  /** Shadow allowance, degrees (0..5). */
  margin: number;
  /** Landing accuracy, metres. */
  accuracy: number;
  /** Aim offset from the target, metres. */
  aim: { east: number; north: number };
  /** Time marker, days after landing (0..30). */
  t: number;
}

export const DATE_MIN = '2020-01-01';
export const DATE_MAX = '2040-12-31';
export const ACCURACIES = [100, 250, 320];

export const DEFAULT_SCENARIO: Scenario = {
  site: 'im2',
  date: '2025-03-06',
  hour: 0,
  margin: 2,
  accuracy: 250,
  aim: { east: 0, north: 0 },
  t: 0,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isAllowedDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  // Reject impossible dates such as 2025-02-31 that Date would roll over.
  if (new Date(ms).toISOString().slice(0, 10) !== s) return false;
  return s >= DATE_MIN && s <= DATE_MAX;
}

export interface ParsedScenario {
  scenario: Scenario;
  /** Plain-language reasons for any value that was replaced. */
  notices: string[];
  /** True when the address carried a scenario (a shared link). */
  present: boolean;
}

function num(v: string | null): number | undefined {
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseScenario(params: URLSearchParams): ParsedScenario {
  const d = DEFAULT_SCENARIO;
  const notices: string[] = [];

  const site = params.get('site')?.trim() || d.site;

  let date = d.date;
  const rawDate = params.get('date');
  if (rawDate !== null) {
    if (isAllowedDate(rawDate)) date = rawDate;
    else {
      notices.push(
        `The link asked for the date “${rawDate}”, which is outside the allowed dates (${DATE_MIN} to ${DATE_MAX}). Showing ${d.date} instead.`,
      );
    }
  }

  const h = num(params.get('hour'));
  const hour = h !== undefined && Number.isInteger(h) && h >= 0 && h <= 23 ? h : d.hour;

  const m = num(params.get('margin'));
  const margin = m !== undefined && m >= 0 && m <= 5 ? m : d.margin;

  const a = num(params.get('accuracy'));
  const accuracy = a !== undefined && ACCURACIES.includes(a) ? a : d.accuracy;

  let aim = d.aim;
  const rawAim = params.get('aim');
  if (rawAim) {
    const [e, n] = rawAim.split(',').map((x) => Number(x));
    if (Number.isFinite(e) && Number.isFinite(n)) aim = { east: e!, north: n! };
  }

  const tt = num(params.get('t'));
  const t = tt !== undefined && tt >= 0 && tt <= 30 ? tt : d.t;

  return {
    scenario: { site, date, hour, margin, accuracy, aim, t },
    notices,
    present: params.has('site'),
  };
}

/** Canonical query string for a scenario (no leading "?"). */
export function scenarioToQuery(s: Scenario): string {
  const p = new URLSearchParams();
  p.set('site', s.site);
  p.set('date', s.date);
  p.set('hour', String(s.hour));
  p.set('margin', String(s.margin));
  p.set('accuracy', String(s.accuracy));
  if (s.aim.east !== 0 || s.aim.north !== 0) p.set('aim', `${s.aim.east},${s.aim.north}`);
  if (s.t > 0) p.set('t', String(s.t));
  return p.toString();
}

/** Move a date by whole days, staying inside the allowed dates. */
export function slipDate(date: string, days: number): string {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  if (next < DATE_MIN) return DATE_MIN;
  if (next > DATE_MAX) return DATE_MAX;
  return next;
}
