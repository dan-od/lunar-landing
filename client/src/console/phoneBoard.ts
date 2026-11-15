// Pure helpers for the phone Console: the filter chips, stepping through the
// filtered sites on the site card, the one-sentence reason under the big status,
// the ready stretches for each tile's 30-day strip, and the next change. All of
// it is read from the one calculator's results; nothing is estimated.
import { changesFrom, type Change, type StateWord, type Window, type WindowResult } from '@moon/core';
import type { Readout } from '../siteData';
import type { SiteRow } from './types';

export type FilterKey = 'all' | 'ready' | 'nopower' | 'nolink' | 'dark';

export const FILTERS: Array<{ key: FilterKey; label: string; word?: StateWord; symbol?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready', word: 'READY', symbol: '●' },
  { key: 'nopower', label: 'No power', word: 'NO POWER', symbol: '▲' },
  { key: 'nolink', label: 'No link', word: 'NO LINK', symbol: '■' },
  { key: 'dark', label: 'Dark', word: 'DARK, NO LINK', symbol: '✕' },
];

/** Does a site pass a filter? Filters use the state at the landing moment, like the tiles. */
export function matchesFilter(row: SiteRow, key: FilterKey): boolean {
  if (key === 'all') return true;
  const word = FILTERS.find((f) => f.key === key)?.word;
  return row.landing?.word === word;
}

export function filterCounts(rows: SiteRow[]): Record<FilterKey, number> {
  const out = { all: rows.length, ready: 0, nopower: 0, nolink: 0, dark: 0 } as Record<FilterKey, number>;
  for (const f of FILTERS) if (f.key !== 'all') out[f.key] = rows.filter((r) => matchesFilter(r, f.key)).length;
  return out;
}

/** The site before or after `current` among `ids`; undefined at either end. */
export function stepSite(ids: string[], current: string, dir: -1 | 1): string | undefined {
  const i = ids.indexOf(current);
  if (i < 0) return ids[0];
  return ids[i + dir];
}

const deg = (v: number) => `${Math.abs(v).toFixed(1)}°`;

/**
 * One sentence that says why the site has its state at this moment, using the
 * same heights and thresholds the calculator used.
 */
export function reasonFor(r: Readout, terrain: boolean): string {
  const limit = (th: number) => (terrain ? `the ${deg(th)} terrain horizon that way` : `the ${deg(th)} shadow allowance`);
  const clause = (name: string, elev: number, th: number) => {
    if (elev < 0) return `${name} is below the horizon`;
    return `${name} is ${deg(elev)} high, ${elev < th ? 'under' : 'not above'} ${limit(th)}`;
  };
  switch (r.state.word) {
    case 'READY':
      return (
        `The Sun is ${deg(r.sunElev)} high and Earth ${deg(r.earthElev)}, both above ` +
        `${terrain ? 'the terrain horizon' : `the ${deg(r.sunThreshold)} shadow allowance`}, so a lander here has power and a line to Earth.`
      );
    case 'NO LINK':
      return `The Sun is up. ${clause('Earth', r.earthElev, r.earthThreshold)}, so a lander here can’t talk to Earth.`;
    case 'NO POWER':
      return `Earth is in view. ${clause('The Sun', r.sunElev, r.sunThreshold)}, so a lander here has no sunlight for power.`;
    default:
      return `Neither works: ${clause('the Sun', r.sunElev, r.sunThreshold)}, and ${clause('Earth', r.earthElev, r.earthThreshold)}.`;
  }
}

/** Stretches where the Sun and Earth are both up: where a tile's strip is lit. */
export function readyWindows(result: WindowResult): Window[] {
  const out: Window[] = [];
  for (const p of result.power.windows) {
    const ps = Date.parse(p.start);
    const pe = Date.parse(p.end);
    for (const c of result.contact.windows) {
      const s = Math.max(ps, Date.parse(c.start));
      const e = Math.min(pe, Date.parse(c.end));
      if (e > s) {
        out.push({
          start: new Date(s).toISOString().replace('.000Z', 'Z'),
          end: new Date(e).toISOString().replace('.000Z', 'Z'),
          hours: Math.round((e - s) / 3_600_000),
        });
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Percent of the span where both are up, rounded. */
export function readyPct(result: WindowResult, spanHours: number): number {
  const h = readyWindows(result).reduce((n, w) => n + w.hours, 0);
  return Math.round((h / spanHours) * 100);
}

/** The first change at one site after a moment, before the span ends. */
export function nextChange(result: WindowResult, fromIso: string, hoursLeft: number): Change | undefined {
  return hoursLeft > 0 ? changesFrom(result, fromIso, hoursLeft)[0] : undefined;
}

/** The soonest change at any site after a moment: for the "All sites" line on the card. */
export function nextAcross(
  rows: SiteRow[],
  fromIso: string,
  hoursLeft: number,
): { row: SiteRow; change: Change } | undefined {
  let best: { row: SiteRow; change: Change } | undefined;
  for (const row of rows) {
    if (!row.result) continue;
    const change = nextChange(row.result, fromIso, hoursLeft);
    if (change && (!best || change.time < best.change.time)) best = { row, change };
  }
  return best;
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "SUN 15 NOV · 23:00 UTC". */
export function cardTime(iso: string): string {
  const d = new Date(Date.parse(iso));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} · ${iso.slice(11, 16)} UTC`;
}

/** "15 NOV 2026 · 15:00 UTC" for the phone date bar. */
export function barTime(date: string, hour: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y} · ${String(hour).padStart(2, '0')}:00 UTC`;
}
