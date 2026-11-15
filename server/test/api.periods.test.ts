// New periods (G): any date from 1960 to 2100 is allowed, and a date that is not
// saved yet costs NASA requests. So each visitor may open only a few new dates
// an hour. Saved dates are never counted, and one Console load for a new date
// counts once however many sites it asks for.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createV1Router, type V1Deps } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, type SeriesProvider } from '../src/api/providers.js';

const SAVED_START = '2025-03-06 00:00';

/** Rows for any span; spans starting on 2025-03-06 count as saved, others need NASA. */
function provider(): { p: SeriesProvider; fetched: string[] } {
  const fetched: string[] = [];
  const p: SeriesProvider = {
    async get(site, span, opts) {
      if (span.start !== SAVED_START) {
        opts?.beforeFetch?.();
        fetched.push(`${site.id} ${span.start}`);
      }
      const start = Date.parse(`${span.start.replace(' ', 'T')}:00Z`);
      const stop = Date.parse(`${span.stop.replace(' ', 'T')}:00Z`);
      const rows = (body: 'sun' | 'earth') => {
        const out = [];
        for (let t = start; t <= stop; t += 3_600_000) {
          out.push({ body, time: new Date(t).toISOString().replace('.000Z', 'Z'), azimuthDeg: 90, elevationDeg: 5 });
        }
        return out;
      };
      return { sun: rows('sun'), earth: rows('earth'), saved: span.start === SAVED_START };
    },
  };
  return { p, fetched };
}

function makeApp(overrides: Partial<V1Deps> = {}) {
  const { p, fetched } = provider();
  let now = 1_000_000;
  const app = express();
  app.use(
    '/v1',
    createV1Router({
      sitesRepo: staticSitesRepo(),
      seriesProvider: p,
      periodLimit: { windowMs: 3_600_000, max: 2, now: () => now },
      ...overrides,
    }),
  );
  app.use(apiErrorHandler);
  return { app, fetched, advance: (ms: number) => (now += ms) };
}

describe('new periods per visitor per hour (G)', () => {
  it('never counts dates that are already saved', async () => {
    const { app } = makeApp();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/v1/windows?site=im2&start=2025-03-06&hour=0');
      expect(res.status).toBe(200);
    }
  });

  it('counts one new date once across every site, and refuses the next new date over the limit with a wait time', async () => {
    const { app, advance } = makeApp();
    for (const site of ['im2', 'im1', 'shk', 'ch3', 'ap11']) {
      expect((await request(app).get(`/v1/windows?site=${site}&start=1969-07-20&hour=20`)).status).toBe(200);
    }
    expect((await request(app).get('/v1/windows?site=im2&start=2099-01-01')).status).toBe(200);
    const over = await request(app).get('/v1/windows?site=im2&start=2080-05-05');
    expect(over.status).toBe(429);
    expect(over.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(over.body.error.message).toMatch(/new dates/);
    expect(over.headers['retry-after']).toBeDefined();
    // The dates already opened stay open.
    expect((await request(app).get('/v1/windows?site=im1&start=2099-01-01')).status).toBe(200);
    advance(3_600_000);
    expect((await request(app).get('/v1/windows?site=im2&start=2080-05-05')).status).toBe(200);
  });

  it('applies to sky, slip and report as well', async () => {
    const { app } = makeApp({ periodLimit: { windowMs: 3_600_000, max: 1 } });
    expect((await request(app).get('/v1/sky?site=im2&date=1970-01-01')).status).toBe(200);
    expect((await request(app).get('/v1/slip?site=im2&date=1980-01-01')).status).toBe(429);
    expect(
      (await request(app).get('/v1/report?a_site=im2&a_date=1990-01-01&b_site=im2&b_date=1990-01-01')).status,
    ).toBe(429);
  });
});
