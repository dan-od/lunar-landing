// Cache interface plus an in-memory implementation for tests. The PostgreSQL
// implementation lives in pgCache.ts. Every NASA reply is cached and reused (F-3).
import type { Body, PositionRow } from '@moon/core';

export interface PositionCache {
  /** Cached rows for a site + body, or undefined if nothing is stored yet. */
  get(siteId: string, body: Body): Promise<PositionRow[] | undefined>;
  /** Store rows for a site + body, merging with what is already saved (by hour). */
  put(siteId: string, body: Body, rows: PositionRow[]): Promise<void>;
}

export class MemoryPositionCache implements PositionCache {
  private store = new Map<string, PositionRow[]>();

  private key(siteId: string, body: Body): string {
    return `${siteId}:${body}`;
  }

  async get(siteId: string, body: Body): Promise<PositionRow[] | undefined> {
    const rows = this.store.get(this.key(siteId, body));
    return rows ? rows.map((r) => ({ ...r })) : undefined;
  }

  async put(siteId: string, body: Body, rows: PositionRow[]): Promise<void> {
    const byTime = new Map<string, PositionRow>();
    for (const r of this.store.get(this.key(siteId, body)) ?? []) byTime.set(r.time, r);
    for (const r of rows) byTime.set(r.time, { ...r });
    const merged = [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
    this.store.set(this.key(siteId, body), merged);
  }
}
