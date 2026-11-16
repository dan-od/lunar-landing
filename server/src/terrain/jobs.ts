// The terrain job queue, server side. The server only enqueues jobs and reports
// status; the Python worker computes them. A job is enqueued when a site has no
// terrain yet, or when the map it used has a new version. Visitors who trigger
// jobs (by adding a custom site) are limited to a few per hour.
import type pg from 'pg';
import { loadCatalogue, type CatalogueMap } from './catalogue.js';

export interface TerrainStatus {
  /** 'ready' has terrain; 'preparing' is queued or running; 'none' has neither; 'error' failed. */
  state: 'ready' | 'preparing' | 'none' | 'error';
  mapName?: string;
  mapVersion?: string;
  resolutionM?: number;
  computedAt?: string;
  error?: string;
}

export interface EnqueueResult {
  queued: boolean;
  /** Set when refused for the rate limit: seconds until a slot frees. */
  retryAfterS?: number;
  reason?: 'rate-limited' | 'already-active';
}

export interface SiteLite {
  id: string;
  latitude: number;
  longitude: number;
  custom?: boolean;
}

export interface TerrainJobsRepo {
  enqueue(site: SiteLite, opts?: { ownerSession?: string; stepM?: number; halfM?: number }): Promise<EnqueueResult>;
  status(siteId: string): Promise<TerrainStatus>;
  /** Queue built-in sites that have no terrain yet. Returns how many were queued. */
  sweepBuiltins(sites: SiteLite[]): Promise<number>;
  /** Queue recompute for sites whose map now has a newer catalogue version. */
  sweepMapVersions(sites: SiteLite[]): Promise<number>;
}

export function dbTerrainJobs(
  pool: pg.Pool,
  perHour = 5,
  catalogue: Map<string, CatalogueMap> = loadCatalogue(),
): TerrainJobsRepo {
  async function enqueue(site: SiteLite, opts: { ownerSession?: string; stepM?: number; halfM?: number } = {}): Promise<EnqueueResult> {
    const { ownerSession, stepM = 40, halfM = 400 } = opts;

    if (ownerSession) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n, min(requested_at) AS oldest
           FROM terrain_job_requests
          WHERE owner_session = $1 AND requested_at > now() - interval '1 hour'`,
        [ownerSession],
      );
      if (rows[0].n >= perHour) {
        const oldest = new Date(rows[0].oldest).getTime();
        const retryAfterS = Math.max(1, Math.ceil((oldest + 3_600_000 - Date.now()) / 1000));
        return { queued: false, retryAfterS, reason: 'rate-limited' };
      }
    }

    const ins = await pool.query(
      `INSERT INTO terrain_jobs (site_id, latitude, longitude, step_m, half_m)
       SELECT $1, $2, $3, $4, $5
        WHERE NOT EXISTS (SELECT 1 FROM terrain_jobs
                          WHERE site_id = $1 AND status IN ('queued','running'))
       RETURNING id`,
      [site.id, site.latitude, site.longitude, stepM, halfM],
    );
    if (ins.rows.length === 0) return { queued: false, reason: 'already-active' };

    // Count the request against the visitor's hourly limit only when it queued work.
    if (ownerSession) {
      await pool.query('INSERT INTO terrain_job_requests (owner_session) VALUES ($1)', [ownerSession]);
    }
    return { queued: true };
  }

  async function status(siteId: string): Promise<TerrainStatus> {
    const run = (
      await pool.query(
        'SELECT map_name, map_version, resolution_m, computed_at FROM terrain_runs WHERE site_id = $1',
        [siteId],
      )
    ).rows[0];
    const job = (
      await pool.query(
        'SELECT status, last_error FROM terrain_jobs WHERE site_id = $1 ORDER BY id DESC LIMIT 1',
        [siteId],
      )
    ).rows[0];
    const active = job && (job.status === 'queued' || job.status === 'running');

    if (run) {
      return {
        state: 'ready',
        mapName: run.map_name,
        mapVersion: run.map_version,
        resolutionM: Number(run.resolution_m),
        computedAt: new Date(run.computed_at).toISOString(),
      };
    }
    if (active) return { state: 'preparing' };
    if (job && job.status === 'error') return { state: 'error', error: job.last_error ?? undefined };
    return { state: 'none' };
  }

  async function sweepBuiltins(sites: SiteLite[]): Promise<number> {
    const have = new Set(
      (await pool.query('SELECT site_id FROM terrain_runs')).rows.map((r) => r.site_id as string),
    );
    let queued = 0;
    for (const s of sites) {
      if (s.custom || have.has(s.id)) continue;
      if ((await enqueue(s)).queued) queued++;
    }
    return queued;
  }

  async function sweepMapVersions(sites: SiteLite[]): Promise<number> {
    const byId = new Map(sites.map((s) => [s.id, s]));
    const runs = (
      await pool.query('SELECT site_id, map_name, map_version FROM terrain_runs')
    ).rows;
    let queued = 0;
    for (const r of runs) {
      const cat = catalogue.get(r.map_name);
      const site = byId.get(r.site_id);
      if (cat && site && cat.version !== r.map_version) {
        if ((await enqueue(site)).queued) queued++;
      }
    }
    return queued;
  }

  return { enqueue, status, sweepBuiltins, sweepMapVersions };
}
