// PostgreSQL-backed position cache (used in production; tests use the in-memory
// cache). Reads and writes the position_cache table.
import type pg from 'pg';
import type { Body, PositionRow } from '@moon/core';
import type { PositionCache } from './cache.js';

export class PgPositionCache implements PositionCache {
  constructor(private pool: pg.Pool) {}

  async get(siteId: string, body: Body): Promise<PositionRow[] | undefined> {
    const { rows } = await this.pool.query(
      `SELECT time, azimuth_deg, elevation_deg
         FROM position_cache
        WHERE site_id = $1 AND body = $2
        ORDER BY time`,
      [siteId, body],
    );
    if (rows.length === 0) return undefined;
    return rows.map((r) => ({
      body,
      time: new Date(r.time).toISOString().replace('.000Z', 'Z'),
      azimuthDeg: Number(r.azimuth_deg),
      elevationDeg: Number(r.elevation_deg),
    }));
  }

  async put(siteId: string, body: Body, positions: PositionRow[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const p of positions) {
        await client.query(
          `INSERT INTO position_cache (site_id, body, time, azimuth_deg, elevation_deg)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (site_id, body, time)
           DO UPDATE SET azimuth_deg = EXCLUDED.azimuth_deg,
                         elevation_deg = EXCLUDED.elevation_deg,
                         fetched_at = now()`,
          [siteId, body, p.time, p.azimuthDeg, p.elevationDeg],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
