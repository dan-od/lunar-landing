// Cache interface plus an in-memory implementation for tests. The PostgreSQL
// implementation lives in pgCache.ts. Every NASA reply is cached and reused (F-3).
import type { Body, PositionRow } from '@moon/core';

export interface PositionCache {
  /** Cached rows for a site + body, or undefined if nothing is stored yet. */
  get(siteId: string, body: Body): Promise<PositionRow[] | undefined>;
  /** Store (replace) the rows for a site + body. */
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
    this.store.set(
      this.key(siteId, body),
      rows.map((r) => ({ ...r })),
    );
  }
}
