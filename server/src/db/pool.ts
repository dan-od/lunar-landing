// A single PostgreSQL pool for the process. The server owns the database; the
// browser never talks to it.
import pg from 'pg';

/**
 * How to reach the database, from the environment. Either a full DATABASE_URL
 * (handy for local work), or the separate PGHOST / PGUSER / PGPASSWORD /
 * PGDATABASE values that node-postgres reads by itself. Deployments use the
 * separate values so a password never has to be valid inside a URL.
 */
export function poolOptions(env: NodeJS.ProcessEnv = process.env): pg.PoolConfig | undefined {
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL };
  if (env.PGHOST) return {};
  return undefined;
}

let pool: pg.Pool | undefined;

/** Get the shared pool, creating it on first use. Returns undefined if no DB is configured. */
export function getPool(): pg.Pool | undefined {
  const options = poolOptions();
  if (!options) return undefined;
  if (!pool) {
    pool = new pg.Pool(options);
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
