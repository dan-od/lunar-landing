// 7-1 (correct replies), 7-3 (rate limit with a wait time), 7-4 (errors name the
// field and allowed range). Data comes from the saved NASA reply; no network.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { summarizeSeries } from '@moon/core';
import { parseHorizons } from '../src/horizons/parse.js';
import { createV1Router, type V1Deps } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, type SeriesProvider } from '../src/api/providers.js';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
const sun = parseHorizons(read('horizons_sun_im2_2025-03-06_08.txt'), 'sun');
const earth = parseHorizons(read('horizons_earth_im2_2025-03-06_08.txt'), 'earth');

const fixtureProvider: SeriesProvider = {
  async get() {
    return { sun, earth, saved: true };
  },
};

function makeApp(overrides: Partial<V1Deps> = {}) {
  const app = express();
  app.use('/v1', createV1Router({ sitesRepo: staticSitesRepo(), seriesProvider: fixtureProvider, ...overrides }));
  app.use(apiErrorHandler);
  return app;
}

describe('GET /v1/sites (7-1)', () => {
  it('lists the curated sites with coordinates and source', async () => {
    const res = await request(makeApp()).get('/v1/sites');
    expect(res.status).toBe(200);
    expect(res.body.sites.length).toBeGreaterThanOrEqual(5);
    const im2 = res.body.sites.find((s: { id: string }) => s.id === 'im2');
    expect(im2).toMatchObject({ lat: -84.78, lon: 29.13, has_terrain: true });
    expect(im2.source).toMatch(/lroc/i);
    expect(res.body.model).toBe('smooth Moon');
  });
});

describe('GET /v1/sky (7-1)', () => {
  it('returns NASA positions and the state word for the hour', async () => {
    const res = await request(makeApp()).get('/v1/sky?site=im2&date=2025-03-06&hour=0');
    expect(res.status).toBe(200);
    expect(res.body.sun).toEqual({ azimuth_deg: 74.592006, elevation_deg: 1.726383 });
    expect(res.body.earth).toEqual({ azimuth_deg: 335.35078, elevation_deg: 10.854318 });
    expect(res.body.state).toMatchObject({ word: 'NO POWER', symbol: '▲' }); // Sun under the 2 deg default
    expect(res.body.model).toBe('smooth Moon');
    expect(res.body.scenario).toMatchObject({ site: 'im2', date: '2025-03-06', hour: 0, margin: 2 });
  });

  it('follows the margin parameter', async () => {
    const res = await request(makeApp()).get('/v1/sky?site=im2&date=2025-03-06&hour=0&margin=0');
    expect(res.body.state.word).toBe('READY');
  });

  it('answers 503 rather than inventing data outside the saved span', async () => {
    const res = await request(makeApp()).get('/v1/sky?site=im2&date=2030-01-01');
    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/no saved positions/i);
  });
});

describe('GET /v1/windows (7-1)', () => {
  it('returns windows, uptime, longest gap and next change from the one calculator', async () => {
    const res = await request(makeApp()).get('/v1/windows?site=im2&start=2025-03-06&days=2');
    expect(res.status).toBe(200);
    const expected = summarizeSeries(sun.slice(0, 48), 2); // [start, start + 2 d)
    expect(res.body.power.uptime_pct).toBe(expected.uptimePct);
    expect(res.body.power.longest_gap_days).toBe(expected.longestGapDays);
    expect(res.body.power.next_change_hours).toBe(expected.nextChangeHours);
    expect(res.body.power.windows.length).toBe(expected.windows.length);
    expect(res.body.contact.uptime_pct).toBe(100);
    expect(res.body.series.length).toBe(49); // includes the closing hour
    expect(res.body.series[0]).toMatchObject({ t: '2025-03-06T00:00:00Z', sun_elev: 1.726383 });
    expect(res.body.model).toBe('smooth Moon');
  });
});

describe('errors name the field at fault (7-4)', () => {
  it('a bad latitude returns the allowed range', async () => {
    const res = await request(makeApp()).get('/v1/sky?lat=95&lon=10&date=2025-03-06');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ field: 'lat', allowed: '-90 to 90' });
  });

  it('a bad longitude returns the allowed range', async () => {
    const res = await request(makeApp()).get('/v1/windows?lat=10&lon=400&start=2025-03-06');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ field: 'lon', allowed: '-180 to 360' });
  });

  it('a date outside 2020-2040 is refused with the range', async () => {
    const res = await request(makeApp()).get('/v1/sky?site=im2&date=2050-01-01');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ field: 'date', allowed: '2020-01-01 to 2040-12-31' });
  });

  it('too many days is refused with the range', async () => {
    const res = await request(makeApp()).get('/v1/windows?site=im2&start=2025-03-06&days=61');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ field: 'days', allowed: '1 to 60' });
  });

  it('a missing place names the field', async () => {
    const res = await request(makeApp()).get('/v1/sky?date=2025-03-06');
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('site');
  });

  it('an unknown site is a 404 naming the id', async () => {
    const res = await request(makeApp()).get('/v1/sky?site=nowhere&date=2025-03-06');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('nowhere');
  });
});

describe('rate limit (7-3)', () => {
  it('the request over the limit gets a wait time', async () => {
    const app = makeApp({ rateLimit: { windowMs: 60_000, max: 3 } });
    for (let i = 0; i < 3; i++) {
      const ok = await request(app).get('/v1/sites');
      expect(ok.status).toBe(200);
    }
    const res = await request(app).get('/v1/sites');
    expect(res.status).toBe(429);
    expect(res.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.headers['retry-after']).toBe(String(res.body.error.retryAfterSeconds));
  });

  it('covers every v1 endpoint', async () => {
    const app = makeApp({ rateLimit: { windowMs: 60_000, max: 1 } });
    await request(app).get('/v1/sites');
    expect((await request(app).get('/v1/sky?site=im2&date=2025-03-06')).status).toBe(429);
    expect((await request(app).get('/v1/windows?site=im2&start=2025-03-06')).status).toBe(429);
  });
});
