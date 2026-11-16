// Loads every prepared terrain file (<site>_terrain.json) into horizon_profiles.
// Safe to run on every deploy: inside one transaction per file it replaces that
// site's profiles with exactly the file's points, so running it twice leaves
// the same rows.
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { getPool, closePool } from '../db/pool.js';
import { parseTerrainFile, type TerrainFile } from './file.js';

const here = dirname(fileURLToPath(import.meta.url));

const TERRAIN_FILE_RE = /^[a-z0-9-]+_terrain\.json$/;

/**
 * Every prepared terrain file: from TERRAIN_DIR if set, else beside the compiled
 * loader (the image), else in the repository. Sorted so the order is stable.
 */
export function terrainFilePaths(): string[] {
  const dirs = [process.env.TERRAIN_DIR, here, join(here, '../../../tools/terrain')].filter(
    (p): p is string => Boolean(p),
  );
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((f) => TERRAIN_FILE_RE.test(f))
      .sort()
      .map((f) => join(dir, f));
    if (files.length > 0) return files;
  }
  throw new Error(`No terrain files (<site>_terrain.json) found. Looked in: ${dirs.join(', ')}`);
}

/** The first terrain file (the IM-2 demo site's, by name order). */
export function terrainFilePath(): string {
  return terrainFilePaths().find((p) => p.endsWith('im2_terrain.json')) ?? terrainFilePaths()[0]!;
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
    for (const path of terrainFilePaths()) {
      const terrain = await readTerrainFile(path);
      const count = await loadTerrain(pool, terrain);
      console.log(`Loaded ${count} terrain profiles for ${terrain.siteId} (${terrain.stepM} m grid, ±${terrain.halfM} m).`);
    }
  })()
    .then(() => closePool())
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
