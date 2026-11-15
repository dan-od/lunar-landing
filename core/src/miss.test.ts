import { describe, it, expect } from 'vitest';
import { computeResult, horizonAt } from './calculator.js';
import {
  aimText,
  clampAim,
  latticeCount,
  missGrid,
  outOfTen,
  pointWorks,
  ringOdds,
  safestAim,
  type GridPoint,
  type TerrainPoint,
} from './miss.js';
import type { Body, PositionRow } from './types.js';

function series(body: Body, elev: number, az: number, hours = 240): PositionRow[] {
  const t0 = Date.parse('2025-03-06T00:00:00Z');
  return Array.from({ length: hours }, (_, i) => ({
    body,
    time: new Date(t0 + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
    azimuthDeg: az,
    elevationDeg: elev,
  }));
}

const flat = (h: number) => new Array<number>(360).fill(h);
/** A profile that is flat except for a hill of `peak` degrees around `az`. */
const hill = (az: number, peak: number) => flat(0).map((_, i) => (Math.abs(i - az) <= 5 ? peak : 0));

describe('horizonAt', () => {
  it('reads whole degrees, interpolates between them, and wraps', () => {
    const h = flat(0);
    h[10] = 2;
    h[11] = 4;
    h[359] = 6;
    expect(horizonAt(h, 10)).toBe(2);
    expect(horizonAt(h, 10.5)).toBeCloseTo(3, 9);
    expect(horizonAt(h, 359.5)).toBeCloseTo(3, 9); // halfway from 6 back to h[0] = 0
    expect(horizonAt(h, 370)).toBe(2);
    expect(horizonAt(h, -350)).toBe(2);
  });
});

describe('a point works: the one definition, with terrain (F-7)', () => {
  const sun = series('sun', 3, 70);
  const earth = series('earth', 8, 335);

  it('works when the Sun and Earth clear the terrain in their directions', () => {
    expect(pointWorks(sun, earth, flat(1))).toBe(true);
  });

  it('fails when a hill stands in the Sun’s direction, even though the rest of the sky is open', () => {
    expect(pointWorks(sun, earth, hill(70, 4))).toBe(false);
    expect(pointWorks(sun, earth, hill(200, 4))).toBe(true); // the hill is elsewhere
  });

  it('fails when Earth is behind terrain', () => {
    expect(pointWorks(sun, earth, hill(335, 9))).toBe(false);
  });

  it('is exactly computeResult(...).works with that horizon, and names the terrain model', () => {
    const profile = hill(70, 4);
    const result = computeResult(sun, earth, { marginDeg: 2, horizon: profile });
    expect(pointWorks(sun, earth, profile)).toBe(result.works);
    expect(result.model).toBe('terrain');
    expect(result.landing.word).toBe('NO POWER');
  });

  it('ignores the flat shadow allowance where terrain is prepared', () => {
    // Sun at 3 degrees: under a 5 degree allowance, but well clear of 1 degree terrain.
    expect(computeResult(sun, earth, { marginDeg: 5 }).works).toBe(false);
    expect(computeResult(sun, earth, { marginDeg: 5, horizon: flat(1) }).works).toBe(true);
  });

  it('needs 90 percent of the first 10 days, not just touchdown', () => {
    const fading = series('sun', 3, 70).map((r, i) => (i >= 200 ? { ...r, elevationDeg: -1 } : r));
    expect(pointWorks(fading, earth, flat(1))).toBe(false); // 200 of 240 hours = 83 percent
  });
});

/** A 21 x 21 grid, 40 m apart, where everything east of `shadowFromEast` is in shadow. */
function grid(shadowFromEast: number): GridPoint[] {
  const out: GridPoint[] = [];
  for (let n = -400; n <= 400; n += 40) {
    for (let e = -400; e <= 400; e += 40) out.push({ east: e, north: n, works: e < shadowFromEast });
  }
  return out;
}

describe('ringOdds: the share of working points inside the ring (4-4)', () => {
  it('counts exactly the grid points inside the ring', () => {
    const g = grid(1000); // everything works
    const o = ringOdds(g, { east: 0, north: 0 }, 100, 40);
    // Points within 100 m of the centre on a 40 m lattice: offsets up to (±80, ±40) etc.
    const expected = g.filter((p) => p.east * p.east + p.north * p.north <= 100 * 100).length;
    expect(o.points).toBe(expected);
    expect(o.points).toBe(21);
    expect(o.working).toBe(21);
    expect(o.share).toBe(1);
    expect(o.coverage).toBe(1);
  });

  it('is the working share, by hand, for a shadow edge through the ring', () => {
    const g = grid(40); // east = 40 and beyond is shadow
    const o = ringOdds(g, { east: 0, north: 0 }, 100, 40);
    const inside = g.filter((p) => p.east ** 2 + p.north ** 2 <= 100 ** 2);
    const working = inside.filter((p) => p.works).length;
    expect(o.working).toBe(working);
    expect(o.share).toBeCloseTo(working / inside.length, 12);
    expect(outOfTen(o.share)).toBe(Math.round((working / inside.length) * 10));
  });

  it('follows the aim', () => {
    const g = grid(40);
    expect(ringOdds(g, { east: -200, north: 0 }, 100, 40).share).toBe(1);
    expect(ringOdds(g, { east: 200, north: 0 }, 100, 40).share).toBe(0);
  });

  it('reports how much of the ring lies inside the prepared terrain', () => {
    const g = grid(1000);
    expect(latticeCount(320, 40)).toBe(ringOdds(g, { east: 0, north: 0 }, 320, 40).points);
    const off = ringOdds(g, { east: 280, north: 0 }, 320, 40);
    expect(off.full).toBe(latticeCount(320, 40));
    expect(off.points).toBeLessThan(off.full);
    expect(off.coverage).toBeCloseTo(off.points / off.full, 12);
    expect(off.coverage).toBeLessThan(1);
  });
});

describe('safestAim (4-5)', () => {
  it('has odds at least as high as any other aim whose ring is fully covered', () => {
    const g = grid(40);
    const best = safestAim(g, 250, 40);
    const candidates = g.filter(
      (p) => Math.hypot(p.east, p.north) <= 300 && ringOdds(g, p, 250, 40).coverage === 1,
    );
    expect(candidates.length).toBeGreaterThan(1);
    for (const c of candidates) {
      expect(best.share).toBeGreaterThanOrEqual(ringOdds(g, c, 250, 40).share);
    }
    expect(best.east).toBeLessThan(0); // away from the shadow in the east
    expect(ringOdds(g, best, 250, 40).coverage).toBe(1);
  });

  it('stays on the target when nothing nearby is better', () => {
    expect(safestAim(grid(1000), 250, 40)).toMatchObject({ east: 0, north: 0, share: 1 });
  });

  it('only searches aims whose ring fits inside the prepared terrain', () => {
    // A 320 m ring fits only within 80 m of the centre of a 400 m grid.
    const best = safestAim(grid(-120), 320, 40);
    expect(Math.abs(best.east)).toBeLessThanOrEqual(80);
    expect(Math.abs(best.north)).toBeLessThanOrEqual(80);
  });
});

describe('aim helpers', () => {
  it('snaps to the grid and keeps the aim within 300 m of the target', () => {
    expect(clampAim({ east: 57, north: -23 }, 40, 300)).toEqual({ east: 40, north: -40 });
    const far = clampAim({ east: 900, north: 0 }, 40, 300);
    expect(far).toEqual({ east: 280, north: 0 });
    const diagonal = clampAim({ east: 400, north: 400 }, 40, 300);
    expect(Math.hypot(diagonal.east, diagonal.north)).toBeLessThanOrEqual(300);
  });

  it('describes the aim in plain words', () => {
    expect(aimText({ east: 0, north: 0 })).toBe('on the original target');
    expect(aimText({ east: 120, north: 0 })).toBe('120 m east of the original target');
    expect(aimText({ east: -80, north: 40 })).toBe('80 m west and 40 m north of the original target');
    expect(aimText({ east: 0, north: -200 })).toBe('200 m south of the original target');
  });
});

describe('missGrid', () => {
  it('marks each terrain point with whether a landing there works', () => {
    const sun = series('sun', 3, 70);
    const earth = series('earth', 8, 335);
    const points: TerrainPoint[] = [
      { east: 0, north: 0, heights: flat(1) },
      { east: 40, north: 0, heights: hill(70, 4) },
    ];
    expect(missGrid(sun, earth, points)).toEqual([
      { east: 0, north: 0, works: true },
      { east: 40, north: 0, works: false },
    ]);
  });
});
