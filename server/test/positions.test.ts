import { describe, it, expect } from 'vitest';
import type { Body, PositionRow, Site } from '@moon/core';
import { MemoryPositionCache } from '../src/cache/cache.js';
import { RequestQueue } from '../src/horizons/queue.js';
import { createPositionService, type Fetcher } from '../src/positions.js';

const SITE: Site = {
  id: 'im2',
  name: 'IM-2 target, Mons Mouton',
  short: 'IM-2',
  lat: -84.78,
  lon: 29.13,
  heightKm: 0,
  source: 'test',
  hasTerrain: true,
};

const fakeRows = (body: Body): PositionRow[] => [
  { body, time: '2025-03-06T00:00:00Z', azimuthDeg: 1, elevationDeg: 2 },
];

describe('PositionService', () => {
  it('serializes concurrent fetches (F-2)', async () => {
    let active = 0;
    let maxActive = 0;
    const fetcher: Fetcher = async (_s, body) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return fakeRows(body);
    };
    const svc = createPositionService(new MemoryPositionCache(), new RequestQueue(), fetcher);

    await Promise.all(Array.from({ length: 10 }, () => svc.getSeries(SITE, 'sun', { start: 'a', stop: 'b', step: '1h' })));
    expect(maxActive).toBe(1);
  });

  it('reuses the cache on the second load (F-3)', async () => {
    let calls = 0;
    const fetcher: Fetcher = async (_s, body) => {
      calls++;
      return fakeRows(body);
    };
    const svc = createPositionService(new MemoryPositionCache(), new RequestQueue(), fetcher);
    const span = { start: 'a', stop: 'b', step: '1h' };

    const first = await svc.getSeries(SITE, 'sun', span);
    expect(first.fromCache).toBe(false);
    expect(calls).toBe(1);

    const second = await svc.getSeries(SITE, 'sun', span);
    expect(second.fromCache).toBe(true);
    expect(calls).toBe(1); // no new NASA call
    expect(second.rows).toEqual(first.rows);
  });
});
