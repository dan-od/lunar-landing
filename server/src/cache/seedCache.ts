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
/** Days seeded from today (UTC), so the "Now" button opens on saved positions. */
const TODAY_DAYS = Number(process.env.SEED_TODAY_DAYS ?? 60);

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The spans to seed: the 2025 case, and the days starting today (UTC). Each span
 * asks NASA only for hours not already saved, so running this twice is safe.
 */
export function seedSpans(nowMs: number = Date.now()): HorizonsSpan[] {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const spans: HorizonsSpan[] = [{ start: `${START} 00:00`, stop: `${addDays(START, DAYS)} 00:00`, step: '1h' }];
  // Apollo 11's landing day, for the "How we know it's right" check.
  spans.push({ start: '1969-07-20 00:00', stop: '1969-07-21 00:00', step: '1h' });
  if (TODAY_DAYS > 0) {
    spans.push({ start: `${today} 00:00`, stop: `${addDays(today, TODAY_DAYS)} 00:00`, step: '1h' });
  }
  return spans;
}

export async function seedCache(): Promise<{ rows: number; seconds: number }> {
  const pool = getPool();
  if (!pool) throw new Error('No database is configured (DATABASE_URL or PGHOST); cannot seed the cache.');

  const cache = new PgPositionCache(pool);
  // One shared queue guarantees a single outbound request at a time (F-2).
  const service = createPositionService(cache, new RequestQueue());
  let totalRows = 0;
  const started = Date.now();
  for (const span of seedSpans()) {
    console.log(`Span ${span.start} to ${span.stop}`);
    for (const site of CURATED_SITES) {
      for (const body of ['sun', 'earth'] as const) {
        const t = Date.now();
        const { rows, fromCache } = await service.getSeries(site, body, span);
        totalRows += rows.length;
        const how = fromCache ? 'cache' : `${((Date.now() - t) / 1000).toFixed(1)}s`;
        console.log(`  ${site.id.padEnd(5)} ${body.padEnd(5)} ${String(rows.length).padStart(5)} rows (${how})`);
      }
    }
  }
  const seconds = (Date.now() - started) / 1000;
  return { rows: totalRows, seconds };
}

const invokedDirectly =
  process.argv[1]?.endsWith('seedCache.ts') || process.argv[1]?.endsWith('seedCache.js');
if (invokedDirectly) {
  console.log(`Seeding cache: ${CURATED_SITES.length} sites x {sun, earth}: ${DAYS} days from ${START}, and ${TODAY_DAYS} days from today (UTC)`);
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
