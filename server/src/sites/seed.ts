// Seed the curated sites (with their cited sources) into the sites table.
// Idempotent: safe to run on every deploy.
import { CURATED_SITES } from '@moon/core';
import { getPool, closePool } from '../db/pool.js';

export async function seedSites(): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error('No database is configured (DATABASE_URL or PGHOST); cannot seed sites.');

  for (const s of CURATED_SITES) {
    await pool.query(
      `INSERT INTO sites (id, name, short, latitude, longitude, height_km, source, has_terrain)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         short = EXCLUDED.short,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         height_km = EXCLUDED.height_km,
         source = EXCLUDED.source,
         has_terrain = EXCLUDED.has_terrain`,
      [s.id, s.name, s.short, s.lat, s.lon, s.heightKm, s.source, s.hasTerrain],
    );
  }
  return CURATED_SITES.length;
}

const invokedDirectly = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (invokedDirectly) {
  seedSites()
    .then(async (n) => {
      console.log(`Seeded ${n} sites.`);
      await closePool();
    })
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
