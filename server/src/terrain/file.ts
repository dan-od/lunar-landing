// Reads and checks a prepared terrain file (tools/terrain/im2_terrain.json).
// The file is produced from the LOLA elevation map by the terrain tools; this
// module only validates it. Nothing here creates or alters terrain.
import type { TerrainPoint } from '@moon/core';

export interface TerrainFile {
  siteId: string;
  /** Spacing of the grid, metres. */
  stepM: number;
  /** The grid reaches this far east and north of the target, metres. */
  halfM: number;
  points: TerrainPoint[];
}

const fail = (why: string): never => {
  throw new Error(`Terrain file is not usable: ${why}`);
};

export function parseTerrainFile(raw: unknown): TerrainFile {
  if (typeof raw !== 'object' || raw === null) return fail('it is not an object');
  const doc = raw as Record<string, unknown>;

  if (doc.model !== 'terrain') return fail('model is not "terrain"');
  const siteId = doc.site_id;
  if (typeof siteId !== 'string' || siteId.length === 0) return fail('site_id is missing');

  const grid = doc.grid as Record<string, unknown> | undefined;
  const stepM = Number(grid?.step_m);
  const halfM = Number(grid?.half_m);
  if (!Number.isInteger(stepM) || stepM <= 0) return fail('grid.step_m is missing');
  if (!Number.isInteger(halfM) || halfM <= 0) return fail('grid.half_m is missing');

  if (!Array.isArray(doc.points) || doc.points.length === 0) return fail('it has no points');
  const seen = new Set<string>();
  const points: TerrainPoint[] = doc.points.map((p: unknown, i: number) => {
    const point = p as Record<string, unknown>;
    const east = point.offset_east;
    const north = point.offset_north;
    const heights = point.heights_deg;
    if (!Number.isInteger(east) || !Number.isInteger(north)) return fail(`point ${i} has no whole-metre offsets`);
    if ((east as number) % stepM !== 0 || (north as number) % stepM !== 0) {
      return fail(`point ${i} is not on the ${stepM} m grid`);
    }
    if (!Array.isArray(heights) || heights.length !== 360) return fail(`point ${i} does not have 360 heights`);
    if (!heights.every((h) => typeof h === 'number' && Number.isFinite(h) && h > -90 && h < 90)) {
      return fail(`point ${i} has a height that is not a real angle`);
    }
    const key = `${east},${north}`;
    if (seen.has(key)) return fail(`point ${i} repeats offset ${key}`);
    seen.add(key);
    return { east: east as number, north: north as number, heights: heights as number[] };
  });

  if (typeof grid?.count === 'number' && grid.count !== points.length) {
    return fail(`grid.count says ${grid.count} points but the file holds ${points.length}`);
  }
  return { siteId, stepM, halfM, points };
}
