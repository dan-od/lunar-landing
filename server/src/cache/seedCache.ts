// Seed the position cache: fetch a long hourly span for every curated site, Sun
// then Earth, one request at a time, and store it. Run once per deployment (and
// whenever the span needs extending). After this the Console reads only the cache.
import { CURATED_SITES } from '@moon/core';
import { getPool, closePool } from '../db/pool.js';
import { PgPositionCache } from './pgCache.js';
import { RequestQueue } from '../horizons/queue.js';
import { createPositionService } from '../positions.js';
import type { HorizonsSpan } from '../horizons/client.js';

/** Start 30 days before the 2025 landing so it has 30 days either side. */
const START = process.env.SEED_START ?? '2025-02-04';
const DAYS = Number(process.env.SEED_DAYS ?? 60);

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export async function seedCache(): Promise<{ rows: number; seconds: number }> {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL is not set; cannot seed the cache.');

  const cache = new PgPositionCache(pool);
  // One shared queue guarantees a single outbound request at a time (F-2).
  const service = createPositionService(cache, new RequestQueue());
  const span: HorizonsSpan = { start: `${START} 00:00`, stop: `${addDays(START, DAYS)} 00:00`, step: '1h' };

  let totalRows = 0;
  const started = Date.now();
  for (const site of CURATED_SITES) {
    for (const body of ['sun', 'earth'] as const) {
      const t = Date.now();
      const { rows, fromCache } = await service.getSeries(site, body, span);
      totalRows += rows.length;
      const how = fromCache ? 'cache' : `${((Date.now() - t) / 1000).toFixed(1)}s`;
      console.log(`  ${site.id.padEnd(5)} ${body.padEnd(5)} ${String(rows.length).padStart(5)} rows (${how})`);
    }
  }
  const seconds = (Date.now() - started) / 1000;
  return { rows: totalRows, seconds };
}

const invokedDirectly =
  process.argv[1]?.endsWith('seedCache.ts') || process.argv[1]?.endsWith('seedCache.js');
if (invokedDirectly) {
  console.log(`Seeding cache: ${CURATED_SITES.length} sites x {sun, earth}, ${DAYS} days hourly from ${START}`);
  seedCache()
    .then(async ({ rows, seconds }) => {
      console.log(`Done: ${rows} rows in ${seconds.toFixed(1)}s`);
      await closePool();
    })
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
