// Data providers behind the API routes, defined as interfaces so tests can inject
// in-memory versions and the routes never touch a database or the network directly.
import type { Body, PositionRow, Site } from '@moon/core';
import type pg from 'pg';
import { CURATED_SITES } from '@moon/core';
import type { HorizonsSpan } from '../horizons/client.js';
import { fetchHorizons } from '../horizons/client.js';
import { RequestQueue } from '../horizons/queue.js';
import { PgPositionCache } from '../cache/pgCache.js';
import { MemoryPositionCache } from '../cache/cache.js';
import { createPositionService, type PositionService } from '../positions.js';
import { HorizonsHttpError } from '../horizons/http.js';
import { serviceUnavailable } from './errors.js';

export interface SitesRepo {
  list(): Promise<Site[]>;
  get(id: string): Promise<Site | undefined>;
}

export interface SeriesProvider {
  /**
   * Sun and Earth rows for a site over a span. `saved` is true when they came
   * from the cache; `complete` is false when NASA could not be reached and only
   * part of the span was saved.
   */
  get(
    site: Site,
    span: HorizonsSpan,
  ): Promise<{ sun: PositionRow[]; earth: PositionRow[]; saved: boolean; complete?: boolean }>;
}

/** Curated sites from the shared constant (plus, in production, custom DB sites). */
export function staticSitesRepo(sites: Site[] = CURATED_SITES): SitesRepo {
  return {
    async list() {
      return sites;
    },
    async get(id) {
      return sites.find((s) => s.id === id);
    },
  };
}

export function dbSitesRepo(pool: pg.Pool): SitesRepo {
  const rowToSite = (r: Record<string, unknown>): Site => ({
    id: String(r.id),
    name: String(r.name),
    short: String(r.short),
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    heightKm: Number(r.height_km),
    source: String(r.source),
    hasTerrain: Boolean(r.has_terrain),
    custom: r.owner_session != null,
  });
  return {
    async list() {
      const { rows } = await pool.query('SELECT * FROM sites ORDER BY created_at, id');
      return rows.map(rowToSite);
    },
    async get(id) {
      const { rows } = await pool.query('SELECT * FROM sites WHERE id = $1', [id]);
      return rows[0] ? rowToSite(rows[0]) : undefined;
    },
  };
}

/**
 * Serves curated sites from the DB cache and ad-hoc (lat/lon) points from an
 * on-demand fetch, all through one shared queue so only one NASA request is ever
 * in flight (F-2). Every reply is cached and reused (F-3).
 */
export function appSeriesProvider(pool: pg.Pool): SeriesProvider {
  const queue = new RequestQueue();
  const dbService: PositionService = createPositionService(new PgPositionCache(pool), queue, fetchHorizons);
  const adhocService: PositionService = createPositionService(new MemoryPositionCache(), queue, fetchHorizons);

  return {
    async get(site, span) {
      const service = site.custom ? adhocService : dbService;
      try {
        const sun = await service.getSeries(site, 'sun' as Body, span);
        const earth = await service.getSeries(site, 'earth' as Body, span);
        return {
          sun: sun.rows,
          earth: earth.rows,
          saved: sun.fromCache && earth.fromCache,
          complete: sun.complete && earth.complete,
        };
      } catch (err) {
        if (err instanceof HorizonsHttpError) {
          throw serviceUnavailable("NASA's position service is not answering, and nothing is saved for this request.");
        }
        throw err;
      }
    },
  };
}
