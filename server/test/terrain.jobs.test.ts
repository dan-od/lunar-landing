// Integration tests for the terrain job queue and the status endpoint. They run
// against a real Postgres with the migrations applied; set DATABASE_URL to it.
// Skipped when DATABASE_URL is unset, so the default test run never needs a DB.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import pg from 'pg';
import { dbTerrainJobs, type TerrainJobsRepo } from '../src/terrain/jobs.js';
import { createV1Router } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo } from '../src/api/providers.js';
import type { SiteLite } from '../src/terrain/jobs.js';
import type { Site } from '@moon/core';

const DB = process.env.DATABASE_URL;

describe.skipIf(!DB)('terrain job queue', () => {
  let pool: pg.Pool;
  let jobs: TerrainJobsRepo;

  const site = (id: string, lat: number, lon: number, custom = false): SiteLite => ({
    id, latitude: lat, longitude: lon, custom,
  });

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: DB });
    // one map version in the catalogue the tests can rely on
    jobs = dbTerrainJobs(pool, 5, new Map([
      ['LDEM_80S_80MPP', { name: 'LDEM_80S_80MPP', version: 'ADJ-2015', resolutionM: 80, latMin: -90, latMax: -80 }],
    ]));
  });
  afterAll(async () => { await pool.end(); });

  beforeEach(async () => {
    await pool.query('TRUNCATE terrain_jobs, terrain_runs, terrain_job_requests RESTART IDENTITY');
    await pool.query("DELETE FROM sites WHERE id LIKE 'tj_%'");
    for (const s of ['tj_a', 'tj_b', 'tj_c', 'tj_d', 'tj_e', 'tj_f']) {
      await pool.query(
        "INSERT INTO sites (id,name,short,latitude,longitude,source) VALUES ($1,$1,$1,-85,0,'test') ON CONFLICT (id) DO NOTHING",
        [s],
      );
    }
  });

  it('dedupes an active job per site', async () => {
    expect((await jobs.enqueue(site('tj_a', -85, 0))).queued).toBe(true);
    const again = await jobs.enqueue(site('tj_a', -85, 0));
    expect(again.queued).toBe(false);
    expect(again.reason).toBe('already-active');
  });

  it('limits a visitor to five jobs an hour', async () => {
    const ids = ['tj_a', 'tj_b', 'tj_c', 'tj_d', 'tj_e'];
    for (const id of ids) {
      expect((await jobs.enqueue(site(id, -85, 0), { ownerSession: 'sess1' })).queued).toBe(true);
    }
    const sixth = await jobs.enqueue(site('tj_f', -85, 0), { ownerSession: 'sess1' });
    expect(sixth.queued).toBe(false);
    expect(sixth.reason).toBe('rate-limited');
    expect(sixth.retryAfterS).toBeGreaterThan(0);
    // a different visitor is unaffected
    expect((await jobs.enqueue(site('tj_f', -85, 0), { ownerSession: 'sess2' })).queued).toBe(true);
  });

  it('reports none, preparing, then ready', async () => {
    expect((await jobs.status('tj_a')).state).toBe('none');
    await jobs.enqueue(site('tj_a', -85, 0));
    expect((await jobs.status('tj_a')).state).toBe('preparing');
    await pool.query(
      "INSERT INTO terrain_runs (site_id,map_name,map_version,resolution_m,step_m,half_m,point_count) VALUES ('tj_a','LDEM_80S_80MPP','ADJ-2015',80,40,400,441)",
    );
    const ready = await jobs.status('tj_a');
    expect(ready.state).toBe('ready');
    expect(ready.mapName).toBe('LDEM_80S_80MPP');
    expect(ready.resolutionM).toBe(80);
  });

  it('sweeps built-in sites without terrain, skipping custom and prepared ones', async () => {
    await pool.query(
      "INSERT INTO terrain_runs (site_id,map_name,map_version,resolution_m,step_m,half_m,point_count) VALUES ('tj_a','LDEM_80S_80MPP','ADJ-2015',80,40,400,441)",
    );
    const sites = [site('tj_a', -85, 0), site('tj_b', -85, 0), site('tj_c', -85, 0, true)];
    const queued = await jobs.sweepBuiltins(sites);
    expect(queued).toBe(1); // tj_a has terrain, tj_c is custom; only tj_b queued
    const rows = await pool.query("SELECT site_id FROM terrain_jobs WHERE status='queued'");
    expect(rows.rows.map((r) => r.site_id)).toEqual(['tj_b']);
  });

  it('serves GET /v1/terrain/status for a site', async () => {
    const s: Site = { id: 'tj_a', name: 'tj_a', short: 'tj_a', lat: -85, lon: 0, source: 'test', hasTerrain: false };
    const app = express();
    app.use('/v1', createV1Router({ sitesRepo: staticSitesRepo([s]), seriesProvider: { async get() { throw new Error('no'); } }, terrainJobs: jobs }));
    app.use(apiErrorHandler);
    const res = await request(app).get('/v1/terrain/status?site=tj_a');
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('terrain');
    expect(res.body.state).toBe('none');
  });
});
