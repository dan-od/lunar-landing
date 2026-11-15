// Loads a prepared terrain file into horizon_profiles. Safe to run on every
// deploy: inside one transaction it replaces the site's profiles with exactly
// the file's points, so running it twice leaves the same rows.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { getPool, closePool } from '../db/pool.js';
import { parseTerrainFile, type TerrainFile } from './file.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Where the terrain file is: set explicitly, beside the compiled loader, or in the repository. */
export function terrainFilePath(): string {
  const candidates = [
    process.env.TERRAIN_FILE,
    join(here, 'im2_terrain.json'),
    join(here, '../../../tools/terrain/im2_terrain.json'),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`Terrain file not found. Looked in: ${candidates.join(', ')}`);
  return found;
}

export async function readTerrainFile(path = terrainFilePath()): Promise<TerrainFile> {
  return parseTerrainFile(JSON.parse(await readFile(path, 'utf8')));
}

export async function loadTerrain(pool: pg.Pool, terrain: TerrainFile): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const site = await client.query('SELECT 1 FROM sites WHERE id = $1', [terrain.siteId]);
    if (site.rowCount === 0) {
      throw new Error(`Site "${terrain.siteId}" is not in the sites table. Seed the sites first.`);
    }
    await client.query('DELETE FROM horizon_profiles WHERE site_id = $1', [terrain.siteId]);
    for (const p of terrain.points) {
      await client.query(
        `INSERT INTO horizon_profiles (site_id, offset_east, offset_north, heights_deg)
         VALUES ($1, $2, $3, $4::double precision[])`,
        [terrain.siteId, p.east, p.north, p.heights],
      );
    }
    await client.query('UPDATE sites SET has_terrain = TRUE WHERE id = $1', [terrain.siteId]);
    await client.query('COMMIT');
    return terrain.points.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const invokedDirectly =
  process.argv[1]?.endsWith('loadTerrain.ts') || process.argv[1]?.endsWith('loadTerrain.js');
if (invokedDirectly) {
  (async () => {
    const pool = getPool();
    if (!pool) throw new Error('No database is configured (DATABASE_URL or PGHOST); cannot load terrain.');
    const terrain = await readTerrainFile();
    const count = await loadTerrain(pool, terrain);
    console.log(`Loaded ${count} terrain profiles for ${terrain.siteId} (${terrain.stepM} m grid, ±${terrain.halfM} m).`);
  })()
    .then(() => closePool())
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
