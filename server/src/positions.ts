// Position service: the single path by which the app gets Sun/Earth positions.
// It serves from the cache when it can (F-3) and otherwise fetches through the
// one-at-a-time queue (F-2). All contact with NASA goes through here.
import type { Body, PositionRow, Site } from '@moon/core';
import type { PositionCache } from './cache/cache.js';
import { RequestQueue } from './horizons/queue.js';
import { fetchHorizons, type HorizonsSpan } from './horizons/client.js';

/** A fetcher that returns one body's series for a site. Injectable for tests. */
export type Fetcher = (site: Site, body: Body, span: HorizonsSpan) => Promise<PositionRow[]>;

export interface SeriesResult {
  rows: PositionRow[];
  fromCache: boolean;
}

export interface PositionService {
  getSeries(site: Site, body: Body, span: HorizonsSpan): Promise<SeriesResult>;
}

export function createPositionService(
  cache: PositionCache,
  queue: RequestQueue = new RequestQueue(),
  fetcher: Fetcher = fetchHorizons,
): PositionService {
  return {
    async getSeries(site, body, span) {
      const cached = await cache.get(site.id, body);
      if (cached && cached.length > 0) {
        return { rows: cached, fromCache: true };
      }
      const rows = await queue.enqueue(() => fetcher(site, body, span));
      await cache.put(site.id, body, rows);
      return { rows, fromCache: false };
    },
  };
}
