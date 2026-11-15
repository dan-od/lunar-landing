// Position service: the single path by which the app gets Sun/Earth positions.
// It serves from the cache when the cache covers the requested span (F-3) and
// otherwise fetches that span through the one-at-a-time queue (F-2) and saves it.
// All contact with NASA goes through here.
import type { Body, PositionRow, Site } from '@moon/core';
import type { PositionCache } from './cache/cache.js';
import { RequestQueue } from './horizons/queue.js';
import { fetchHorizons, type HorizonsSpan } from './horizons/client.js';

/** A fetcher that returns one body's series for a site. Injectable for tests. */
export type Fetcher = (site: Site, body: Body, span: HorizonsSpan) => Promise<PositionRow[]>;

export interface SeriesResult {
  rows: PositionRow[];
  /** True when no NASA call was needed. */
  fromCache: boolean;
  /** False when NASA could not be reached and only part of the span was saved. */
  complete: boolean;
}

export interface PositionService {
  /** `beforeFetch` runs only when NASA must be asked; it may throw to refuse (the new-period limit). */
  getSeries(site: Site, body: Body, span: HorizonsSpan, beforeFetch?: () => void): Promise<SeriesResult>;
}

const HOUR_MS = 3_600_000;

/** 'YYYY-MM-DD HH:MM' (UTC) to epoch ms. */
export function spanTimeToMs(t: string): number {
  return Date.parse(`${t.replace(' ', 'T')}:00Z`);
}

function inSpan(rows: PositionRow[], startMs: number, stopMs: number): PositionRow[] {
  return rows.filter((r) => {
    const t = Date.parse(r.time);
    return t >= startMs && t <= stopMs;
  });
}

export function createPositionService(
  cache: PositionCache,
  queue: RequestQueue = new RequestQueue(),
  fetcher: Fetcher = fetchHorizons,
): PositionService {
  async function cached(site: Site, body: Body, span: HorizonsSpan) {
    const startMs = spanTimeToMs(span.start);
    const stopMs = spanTimeToMs(span.stop);
    const expected = Math.round((stopMs - startMs) / HOUR_MS) + 1;
    const rows = inSpan((await cache.get(site.id, body)) ?? [], startMs, stopMs);
    return { rows, covered: rows.length >= expected };
  }

  return {
    async getSeries(site, body, span, beforeFetch) {
      const first = await cached(site, body, span);
      if (first.covered) return { rows: first.rows, fromCache: true, complete: true };
      beforeFetch?.();

      return queue.enqueue(async () => {
        // Another request may have filled the cache while this one waited.
        const again = await cached(site, body, span);
        if (again.covered) return { rows: again.rows, fromCache: true, complete: true };
        try {
          const rows = await fetcher(site, body, span);
          await cache.put(site.id, body, rows);
          return { rows, fromCache: false, complete: true };
        } catch (err) {
          // NASA unavailable: fall back to whatever is saved for this span.
          if (again.rows.length > 0) return { rows: again.rows, fromCache: true, complete: false };
          throw err;
        }
      });
    },
  };
}
