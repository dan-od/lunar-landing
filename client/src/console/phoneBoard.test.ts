import { describe, it, expect } from 'vitest';
import { computeResult, type PositionRow, type SiteState } from '@moon/core';
import type { Readout } from '../siteData';
import type { SiteRow } from './types';
import {
  barTime,
  cardTime,
  filterCounts,
  matchesFilter,
  nextAcross,
  readyPct,
  readyWindows,
  reasonFor,
  stepSite,
} from './phoneBoard';

const T0 = Date.parse('2025-03-06T00:00:00Z');
const iso = (h: number) => new Date(T0 + h * 3_600_000).toISOString().replace('.000Z', 'Z');
const rows = (body: 'sun' | 'earth', up: (h: number) => boolean, n = 48): PositionRow[] =>
  Array.from({ length: n }, (_, h) => ({ body, time: iso(h), azimuthDeg: 90, elevationDeg: up(h) ? 10 : -5 }));

const state = (word: SiteState['word']): SiteState => ({ word, symbol: '', powerUp: false, linkUp: false });
const row = (id: string, word?: SiteState['word']): SiteRow => ({
  site: { id, name: id, lat: -89, lon: 0, source: 'test', has_terrain: false },
  short: id,
  ...(word ? { landing: state(word) } : {}),
});

describe('filter chips', () => {
  const list = [row('a', 'READY'), row('b', 'READY'), row('c', 'NO POWER'), row('d', 'NO LINK'), row('e', 'DARK, NO LINK'), row('f')];

  it('counts each state once, and All counts every site including those without data', () => {
    expect(filterCounts(list)).toEqual({ all: 6, ready: 2, nopower: 1, nolink: 1, dark: 1 });
  });

  it('No link means exactly NO LINK; Dark means dark with no link', () => {
    expect(list.filter((r) => matchesFilter(r, 'nolink')).map((r) => r.site.id)).toEqual(['d']);
    expect(list.filter((r) => matchesFilter(r, 'dark')).map((r) => r.site.id)).toEqual(['e']);
    expect(list.filter((r) => matchesFilter(r, 'all'))).toHaveLength(6);
  });
});

describe('stepping through the filtered sites on the card', () => {
  it('goes to the neighbour and stops at either end', () => {
    expect(stepSite(['a', 'b', 'c'], 'b', 1)).toBe('c');
    expect(stepSite(['a', 'b', 'c'], 'b', -1)).toBe('a');
    expect(stepSite(['a', 'b', 'c'], 'c', 1)).toBeUndefined();
    expect(stepSite(['a', 'b', 'c'], 'a', -1)).toBeUndefined();
  });
});

describe('the reason under the big status', () => {
  const base = { time: iso(0), sunAz: 90, earthAz: 0, sunThreshold: 2, earthThreshold: 2 };
  const r = (sunElev: number, earthElev: number, word: SiteState['word']): Readout => ({ ...base, sunElev, earthElev, state: state(word) });

  it('names the height and the allowance that was missed', () => {
    expect(reasonFor(r(2.7, 1.6, 'NO LINK'), false)).toBe(
      'The Sun is up. Earth is 1.6° high, under the 2.0° shadow allowance, so a lander here can’t talk to Earth.',
    );
    expect(reasonFor(r(-3, 5, 'NO POWER'), false)).toBe(
      'Earth is in view. The Sun is below the horizon, so a lander here has no sunlight for power.',
    );
    expect(reasonFor(r(6.1, 4.8, 'READY'), false)).toMatch(/^The Sun is 6.1° high and Earth 4.8°, both above the 2.0° shadow allowance/);
    expect(reasonFor(r(1, -2, 'DARK, NO LINK'), false)).toBe(
      'Neither works: the Sun is 1.0° high, under the 2.0° shadow allowance, and Earth is below the horizon.',
    );
  });

  it('speaks of the terrain horizon on the terrain model', () => {
    expect(reasonFor({ ...r(3, 1, 'NO LINK'), earthThreshold: 2.4 }, true)).toContain('under the 2.4° terrain horizon that way');
  });

  it('is one sentence', () => {
    for (const w of ['READY', 'NO POWER', 'NO LINK', 'DARK, NO LINK'] as const) {
      expect(reasonFor(r(1, 1, w), false).match(/\.(\s|$)/g)?.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('tile strip and next changes', () => {
  // Sun up 0-9 and 30-47; Earth up 5-47.
  const result = computeResult(rows('sun', (h) => h < 10 || h >= 30), rows('earth', (h) => h >= 5), { marginDeg: 2 });

  it('lights only the hours where both are up', () => {
    const w = readyWindows(result);
    expect(w.map((x) => [x.start, x.hours])).toEqual([
      [iso(5), 5],
      [iso(30), w[1]!.hours],
    ]);
    expect(readyPct(result, 48)).toBe(Math.round(((5 + w[1]!.hours) / 48) * 100));
  });

  it('finds the soonest change across sites', () => {
    const late = computeResult(rows('sun', (h) => h < 20), rows('earth', () => true), { marginDeg: 2 });
    const a = { ...row('a'), result: late };
    const b = { ...row('b'), result };
    const next = nextAcross([a, b], iso(0), 48);
    expect(next?.row.site.id).toBe('b');
    expect(next?.change.kind).toBe('earthrise');
  });
});

describe('time labels', () => {
  it('formats the date bar and the card times in UTC', () => {
    expect(barTime('2026-11-15', 15)).toBe('15 NOV 2026 · 15:00 UTC');
    expect(cardTime('2026-11-15T23:00:00Z')).toBe('SUN 15 NOV · 23:00 UTC');
  });
});
