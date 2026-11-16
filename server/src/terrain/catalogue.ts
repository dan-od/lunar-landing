// Reads the map catalogue (tools/terrain/maps.json) so the server can name a
// map's resolution and spot when a map has a new version. The worker owns the
// heavy reading of the maps themselves; the server only needs these facts.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export interface CatalogueMap {
  name: string;
  version: string;
  resolutionM: number;
  latMin: number;
  latMax: number;
}

export function mapsJsonPath(): string {
  const candidates = [
    process.env.TERRAIN_MAPS_JSON,
    join(here, 'maps.json'),
    join(here, '../../../tools/terrain/maps.json'),
    join(here, '../../../../tools/terrain/maps.json'),
  ].filter((p): p is string => Boolean(p));
  return candidates.find(existsSync) ?? candidates[candidates.length - 1]!;
}

export function loadCatalogue(path = mapsJsonPath()): Map<string, CatalogueMap> {
  const out = new Map<string, CatalogueMap>();
  if (!existsSync(path)) return out;
  const doc = JSON.parse(readFileSync(path, 'utf8')) as {
    maps: Array<{ name: string; version: string; resolution_m: number; coverage: { lat_min: number; lat_max: number } }>;
  };
  for (const m of doc.maps) {
    out.set(m.name, {
      name: m.name,
      version: m.version,
      resolutionM: m.resolution_m,
      latMin: m.coverage.lat_min,
      latMax: m.coverage.lat_max,
    });
  }
  return out;
}
