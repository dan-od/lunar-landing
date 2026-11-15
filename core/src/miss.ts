// Flow 4: what if the landing misses? Pure rules shared by the Miss page, the
// API and (later) the watch rule and the assistant connector, so they cannot
// disagree (F-7). Only prepared terrain is used: a point outside the prepared
// grid is never guessed at.
import { computeResult } from './calculator.js';
import type { PositionRow } from './types.js';

/** A prepared terrain point: metres east and north of the target, and its horizon. */
export interface TerrainPoint {
  east: number;
  north: number;
  /** 360 horizon heights in degrees; index = degrees clockwise from north. */
  heights: number[];
}

/** A grid point and whether a landing there works. */
export interface GridPoint {
  east: number;
  north: number;
  works: boolean;
}

export interface Aim {
  east: number;
  north: number;
}

/** The three lander accuracies the Miss tab reports, in metres. */
export const MISS_RADII = [100, 250, 320];
/** How far the aim may be moved from the original target, in metres. */
export const MAX_AIM_DISTANCE = 300;

/**
 * Does a landing at this point work? Sun and Earth must clear the point's own
 * terrain horizon at touchdown and for at least 90% of the first 10 days.
 */
export function pointWorks(sun: PositionRow[], earth: PositionRow[], heights: number[]): boolean {
  return computeResult(sun, earth, { marginDeg: 0, horizon: heights }).works;
}

export function missGrid(sun: PositionRow[], earth: PositionRow[], points: TerrainPoint[]): GridPoint[] {
  return points.map((p) => ({ east: p.east, north: p.north, works: pointWorks(sun, earth, p.heights) }));
}

/** How many grid points a full ring of this radius holds (an aim always sits on a grid point). */
export function latticeCount(radiusM: number, stepM: number): number {
  const k = Math.floor(radiusM / stepM);
  let count = 0;
  for (let i = -k; i <= k; i++) {
    for (let j = -k; j <= k; j++) {
      if ((i * stepM) ** 2 + (j * stepM) ** 2 <= radiusM ** 2) count++;
    }
  }
  return count;
}

export interface RingOdds {
  /** Share of prepared points inside the ring where a landing works (0..1). */
  share: number;
  working: number;
  /** Prepared points inside the ring. */
  points: number;
  /** Points a ring of this size would hold if it lay wholly inside the prepared terrain. */
  full: number;
  /** points / full: 1 when the whole ring is inside the prepared terrain. */
  coverage: number;
}

/** The share of working points inside a ring around the aim (4-4). */
export function ringOdds(grid: GridPoint[], aim: Aim, radiusM: number, stepM: number): RingOdds {
  let points = 0;
  let working = 0;
  const r2 = radiusM * radiusM;
  for (const p of grid) {
    const de = p.east - aim.east;
    const dn = p.north - aim.north;
    if (de * de + dn * dn <= r2) {
      points++;
      if (p.works) working++;
    }
  }
  const full = latticeCount(radiusM, stepM);
  return {
    share: points === 0 ? 0 : working / points,
    working,
    points,
    full,
    coverage: full === 0 ? 0 : Math.min(1, points / full),
  };
}

/** "N out of 10 landings would work". */
export function outOfTen(share: number): number {
  return Math.round(share * 10);
}

/** Snap an aim to the grid and keep it within reach of the target. */
export function clampAim(aim: Aim, stepM: number, maxDistanceM = MAX_AIM_DISTANCE): Aim {
  let east = aim.east;
  let north = aim.north;
  const d = Math.hypot(east, north);
  if (d > maxDistanceM) {
    east = (east * maxDistanceM) / d;
    north = (north * maxDistanceM) / d;
  }
  const snap = (v: number) => {
    const s = Math.round(v / stepM) * stepM;
    return s === 0 ? 0 : s; // avoid -0
  };
  east = snap(east);
  north = snap(north);
  // Rounding outward can leave the circle by a step; pull the longer side in.
  while (Math.hypot(east, north) > maxDistanceM) {
    if (Math.abs(east) >= Math.abs(north)) east -= Math.sign(east) * stepM;
    else north -= Math.sign(north) * stepM;
  }
  return { east, north };
}

export interface SafestAim extends Aim {
  share: number;
}

/**
 * The best aim within reach of the target (4-5). Only aims whose ring lies
 * wholly inside the prepared terrain are considered, so the answer never rests
 * on ground that was not prepared. Ties go to the aim nearest the target.
 */
export function safestAim(
  grid: GridPoint[],
  radiusM: number,
  stepM: number,
  maxDistanceM = MAX_AIM_DISTANCE,
): SafestAim {
  let best: SafestAim = { east: 0, north: 0, share: ringOdds(grid, { east: 0, north: 0 }, radiusM, stepM).share };
  let bestDistance = 0;
  for (const p of grid) {
    const distance = Math.hypot(p.east, p.north);
    if (distance > maxDistanceM) continue;
    const odds = ringOdds(grid, p, radiusM, stepM);
    if (odds.coverage < 1) continue;
    if (odds.share > best.share + 1e-12 || (Math.abs(odds.share - best.share) <= 1e-12 && distance < bestDistance)) {
      best = { east: p.east, north: p.north, share: odds.share };
      bestDistance = distance;
    }
  }
  return best;
}

/** Where the aim is, in plain words. */
export function aimText(aim: Aim): string {
  if (aim.east === 0 && aim.north === 0) return 'on the original target';
  const parts: string[] = [];
  if (aim.east !== 0) parts.push(`${Math.abs(aim.east)} m ${aim.east > 0 ? 'east' : 'west'}`);
  if (aim.north !== 0) parts.push(`${Math.abs(aim.north)} m ${aim.north > 0 ? 'north' : 'south'}`);
  return `${parts.join(' and ')} of the original target`;
}
