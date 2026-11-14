// A single PostgreSQL pool for the process. The server owns the database; the
// browser never talks to it.
import pg from 'pg';
import { config } from '../config.js';

let pool: pg.Pool | undefined;

/** Get the shared pool, creating it on first use. Returns undefined if no DB is configured. */
export function getPool(): pg.Pool | undefined {
  if (!config.databaseUrl) return undefined;
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

/** Ping the database. Returns true if it answers, false otherwise. */
export async function pingDb(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Close the pool (used on shutdown and in tests). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
