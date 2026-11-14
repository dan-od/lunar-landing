// Minimal forward-only SQL migration runner. Applies every .sql file in
// migrations/ in filename order, once each, inside a transaction, and records
// applied files in schema_migrations.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function runMigrations(): Promise<string[]> {
  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL is not set; cannot run migrations.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (rows.length > 0) continue;

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return applied;
}

// Allow running directly: `npm run migrate`.
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runMigrations()
    .then(async (applied) => {
      console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'No new migrations.');
      await closePool();
    })
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
