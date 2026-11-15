// The loader's file checks, run against the real committed terrain file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseTerrainFile } from '../src/terrain/file.js';
import { terrainFilePath } from '../src/terrain/loadTerrain.js';

const realPath = fileURLToPath(new URL('../../tools/terrain/im2_terrain.json', import.meta.url));
const real = () => JSON.parse(readFileSync(realPath, 'utf8')) as Record<string, unknown>;

describe('the committed IM-2 terrain file', () => {
  const t = parseTerrainFile(real());

  it('is the 441-point grid for im2 that reaches at least 320 m in every direction (4-1)', () => {
    expect(t.siteId).toBe('im2');
    expect(t.points.length).toBe(441);
    expect(t.stepM).toBe(40);
    expect(t.halfM).toBeGreaterThanOrEqual(320);
    const easts = t.points.map((p) => p.east);
    const norths = t.points.map((p) => p.north);
    expect(Math.min(...easts)).toBe(-t.halfM);
    expect(Math.max(...easts)).toBe(t.halfM);
    expect(Math.min(...norths)).toBe(-t.halfM);
    expect(Math.max(...norths)).toBe(t.halfM);
  });

  it('has 360 real heights at every point', () => {
    for (const p of t.points) {
      expect(p.heights.length).toBe(360);
    }
    // The terrain report gives the range across the grid as -1.497 to 4.774 degrees.
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of t.points) {
      for (const h of p.heights) {
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    expect(lo).toBeCloseTo(-1.497, 2);
    expect(hi).toBeCloseTo(4.774, 2);
  });

  it('is found by the loader from the repository', () => {
    expect(terrainFilePath()).toMatch(/im2_terrain\.json$/);
  });
});

describe('parseTerrainFile refuses a file it cannot trust', () => {
  const edit = (change: (doc: Record<string, unknown>) => void) => {
    const doc = real();
    change(doc);
    return () => parseTerrainFile(doc);
  };
  const points = (doc: Record<string, unknown>) => doc.points as Array<Record<string, unknown>>;

  it('wrong model', () => {
    expect(edit((d) => (d.model = 'smooth Moon'))).toThrow(/model/);
  });
  it('a point with too few heights', () => {
    expect(edit((d) => (points(d)[3]!.heights_deg = [1, 2, 3]))).toThrow(/360 heights/);
  });
  it('a height that is not a number', () => {
    expect(edit((d) => ((points(d)[3]!.heights_deg as unknown[])[10] = null))).toThrow(/real angle/);
  });
  it('a point off the grid', () => {
    expect(edit((d) => (points(d)[3]!.offset_east = 7))).toThrow(/grid/);
  });
  it('a repeated point', () => {
    expect(edit((d) => (points(d)[1] = { ...points(d)[0]! }))).toThrow(/repeats/);
  });
  it('a count that does not match', () => {
    expect(edit((d) => points(d).pop())).toThrow(/441/);
  });
  it('no points', () => {
    expect(edit((d) => (d.points = []))).toThrow(/no points/);
  });
});
