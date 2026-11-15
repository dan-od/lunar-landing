import { describe, it, expect } from 'vitest';
import type { Body, PositionRow, Site } from '@moon/core';
import { MemoryPositionCache } from '../src/cache/cache.js';
import { RequestQueue } from '../src/horizons/queue.js';
import { createPositionService, type Fetcher } from '../src/positions.js';
import type { HorizonsSpan } from '../src/horizons/client.js';

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

/** Hourly rows covering a span, the way NASA would return them. */
function rowsFor(body: Body, span: HorizonsSpan): PositionRow[] {
  const start = Date.parse(`${span.start.replace(' ', 'T')}:00Z`);
  const stop = Date.parse(`${span.stop.replace(' ', 'T')}:00Z`);
  const out: PositionRow[] = [];
  for (let t = start; t <= stop; t += 3_600_000) {
    out.push({ body, time: new Date(t).toISOString().replace('.000Z', 'Z'), azimuthDeg: 1, elevationDeg: 2 });
  }
  return out;
}

const SPAN: HorizonsSpan = { start: '2025-03-06 00:00', stop: '2025-03-06 06:00', step: '1h' };

describe('PositionService', () => {
  it('never has two NASA requests in flight, even under ten simultaneous loads (F-2)', async () => {
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const fetcher: Fetcher = async (_s, body, span) => {
      calls++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return rowsFor(body, span);
    };
    const svc = createPositionService(new MemoryPositionCache(), new RequestQueue(), fetcher);

    // Ten page loads, each needing Sun and Earth for two different spans.
    const other: HorizonsSpan = { start: '2025-03-07 00:00', stop: '2025-03-07 06:00', step: '1h' };
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        Promise.all([
          svc.getSeries(SITE, 'sun', i % 2 ? SPAN : other),
          svc.getSeries(SITE, 'earth', i % 2 ? SPAN : other),
        ]),
      ),
    );
    expect(maxActive).toBe(1);
    expect(calls).toBe(4); // 2 bodies x 2 spans; the other 16 loads reused the cache
  });

  it('reuses the cache on the second load (F-3)', async () => {
    let calls = 0;
    const fetcher: Fetcher = async (_s, body, span) => {
      calls++;
      return rowsFor(body, span);
    };
    const svc = createPositionService(new MemoryPositionCache(), new RequestQueue(), fetcher);

    const first = await svc.getSeries(SITE, 'sun', SPAN);
    expect(first.fromCache).toBe(false);
    expect(calls).toBe(1);

    const second = await svc.getSeries(SITE, 'sun', SPAN);
    expect(second.fromCache).toBe(true);
    expect(calls).toBe(1); // no new NASA call
    expect(second.rows).toEqual(first.rows);
  });

  it('serves a sub-span from the cache and fetches only when the span is not covered', async () => {
    let calls = 0;
    const fetcher: Fetcher = async (_s, body, span) => {
      calls++;
      return rowsFor(body, span);
    };
    const svc = createPositionService(new MemoryPositionCache(), new RequestQueue(), fetcher);
    await svc.getSeries(SITE, 'sun', SPAN);

    const inside = await svc.getSeries(SITE, 'sun', { start: '2025-03-06 02:00', stop: '2025-03-06 04:00', step: '1h' });
    expect(inside.fromCache).toBe(true);
    expect(inside.rows.length).toBe(3);
    expect(calls).toBe(1);

    const beyond = await svc.getSeries(SITE, 'sun', { start: '2025-03-06 04:00', stop: '2025-03-06 09:00', step: '1h' });
    expect(beyond.fromCache).toBe(false);
    expect(calls).toBe(2);
  });

  it('falls back to saved rows, marked incomplete, when NASA is unavailable', async () => {
    let fail = false;
    const fetcher: Fetcher = async (_s, body, span) => {
      if (fail) throw new Error('down');
      return rowsFor(body, span);
    };
    const svc = createPositionService(new MemoryPositionCache(), new RequestQueue(), fetcher);
    await svc.getSeries(SITE, 'sun', SPAN);
    fail = true;

    const partial = await svc.getSeries(SITE, 'sun', { start: '2025-03-06 04:00', stop: '2025-03-06 09:00', step: '1h' });
    expect(partial).toMatchObject({ fromCache: true, complete: false });
    expect(partial.rows.length).toBe(3); // 04:00, 05:00, 06:00 were saved

    await expect(
      svc.getSeries(SITE, 'sun', { start: '2026-01-01 00:00', stop: '2026-01-01 03:00', step: '1h' }),
    ).rejects.toThrow('down');
  });
});

describe('new-period hook (G)', () => {
  it('runs only when NASA must be asked, and a refusal stops the fetch', async () => {
    let calls = 0;
    const fetcher: Fetcher = async (_s, body, span) => {
      calls++;
      return rowsFor(body, span);
    };
    const svc = createPositionService(new MemoryPositionCache(), new RequestQueue(), fetcher);
    let hooks = 0;
    await svc.getSeries(SITE, 'sun', SPAN, () => hooks++);
    await svc.getSeries(SITE, 'sun', SPAN, () => hooks++);
    expect(hooks).toBe(1);
    const other: HorizonsSpan = { start: '2030-01-01 00:00', stop: '2030-01-01 06:00', step: '1h' };
    await expect(
      svc.getSeries(SITE, 'sun', other, () => {
        throw new Error('over the limit');
      }),
    ).rejects.toThrow('over the limit');
    expect(calls).toBe(1);
  });
});
