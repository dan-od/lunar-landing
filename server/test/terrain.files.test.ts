// Step 6 (priority): no Miss screen may be empty for a built-in site. Every
// built-in site must therefore have a committed terrain profile the loader
// accepts, with its map name, version and resolution. This also guards against
// a new site being added to the list without terrain being prepared for it.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CURATED_SITES } from '@moon/core';
import { parseTerrainFile } from '../src/terrain/file.js';

const dir = fileURLToPath(new URL('../../tools/terrain/', import.meta.url));

describe('every built-in site has a non-empty terrain profile', () => {
  it('there are built-in sites to check', () => {
    expect(CURATED_SITES.length).toBeGreaterThan(0);
  });

  for (const site of CURATED_SITES) {
    it(`${site.id} (${site.name}) has profiles with map provenance`, () => {
      const path = `${dir}${site.id}_terrain.json`;
      expect(existsSync(path), `${site.id}_terrain.json is missing`).toBe(true);
      const t = parseTerrainFile(JSON.parse(readFileSync(path, 'utf8')));
      expect(t.siteId).toBe(site.id);
      expect(t.points.length).toBeGreaterThan(0);   // a non-empty grid -> a non-empty Miss map
      expect(t.points[0]!.heights.length).toBe(360);
      expect(t.mapName.length).toBeGreaterThan(0);
      expect(t.mapVersion.length).toBeGreaterThan(0);
      expect(t.resolutionM).toBeGreaterThan(0);
    });
  }
});
