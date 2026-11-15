import { describe, it, expect } from 'vitest';
import type { SeriesPoint } from '../api';
import { resultFor, toSeries } from '../siteData';
import { incidents } from './incidents';
import type { SiteRow } from './types';

function points(phase: number): SeriesPoint[] {
  const t0 = Date.parse('2025-03-06T00:00:00Z');
  return Array.from({ length: 31 * 24 }, (_, i) => ({
    t: new Date(t0 + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
    sun_elev: 4 * Math.sin((i + phase) / 110),
    sun_az: 90,
    earth_elev: 6 + 5 * Math.sin((i + phase) / 90),
    earth_az: 335,
  }));
}

function row(id: string, phase: number): SiteRow {
  const series = toSeries(points(phase), '2025-03-06', 0);
  const result = resultFor(series, 2);
  return {
    site: { id, name: id, lat: -85, lon: 0, source: 'test', has_terrain: false },
    short: id,
    series,
    result,
    landing: result.landing,
  };
}

describe('incident list (1-12)', () => {
  const rows = [row('a', 0), row('b', 200), row('c', 400), { site: { id: 'd', name: 'd', lat: 0, lon: 0, source: '', has_terrain: false }, short: 'd' }];
  const list = incidents(rows, '2025-03-06T00:00:00Z');

  it('lists every site’s changes, soonest first', () => {
    expect(list.length).toBeGreaterThan(3);
    for (let i = 1; i < list.length; i++) expect(list[i]!.time >= list[i - 1]!.time).toBe(true);
    expect(new Set(list.map((x) => x.site.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('starts with the earliest next change in the site list', () => {
    const earliest = Math.min(
      ...rows.flatMap((r) => (r.result ? [r.result.power.nextChangeHours ?? Infinity, r.result.contact.nextChangeHours ?? Infinity] : [])),
    );
    expect(list[0]!.hoursAfterLanding).toBe(earliest);
  });
});
