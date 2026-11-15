// Custom coordinates through the API (flow 2): each point gets its own
// positions, and new coordinates are limited per visitor per hour (2-3) because
// each one costs two NASA requests.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Site } from '@moon/core';
import { createV1Router, type V1Deps } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, type SeriesProvider } from '../src/api/providers.js';

/** Positions that depend on the place asked for, and a record of which places were asked. */
function recordingProvider() {
  const asked: Site[] = [];
  const provider: SeriesProvider = {
    async get(site, span) {
      asked.push(site);
      const start = Date.parse(`${span.start.replace(' ', 'T')}:00Z`);
      const stop = Date.parse(`${span.stop.replace(' ', 'T')}:00Z`);
      const rows = (body: 'sun' | 'earth') => {
        const out = [];
        for (let t = start; t <= stop; t += 3_600_000) {
          out.push({
            body,
            time: new Date(t).toISOString().replace('.000Z', 'Z'),
            azimuthDeg: 90,
            // The height encodes the latitude, so two places cannot be mistaken for one another.
            elevationDeg: Math.abs(site.lat) / 10,
          });
        }
        return out;
      };
      return { sun: rows('sun'), earth: rows('earth'), saved: false };
    },
  };
  return { provider, asked };
}

function makeApp(overrides: Partial<V1Deps> = {}) {
  const { provider, asked } = recordingProvider();
  const app = express();
  app.use('/v1', createV1Router({ sitesRepo: staticSitesRepo(), seriesProvider: provider, ...overrides }));
  app.use(apiErrorHandler);
  return { app, asked };
}

describe('custom coordinates', () => {
  it('gives each point its own identity, so one point is never served another’s positions', async () => {
    const { app, asked } = makeApp();
    const a = await request(app).get('/v1/sky?lat=-85&lon=30&date=2025-03-06');
    const b = await request(app).get('/v1/sky?lat=-60&lon=30&date=2025-03-06');
    expect(a.body.sun.elevation_deg).toBe(8.5);
    expect(b.body.sun.elevation_deg).toBe(6);
    expect(asked[0]!.id).not.toBe(asked[1]!.id);
    expect(asked[0]!.custom).toBe(true);
    expect(a.body.scenario).toMatchObject({ lat: -85, lon: 30 });
  });

  it('treats the same point the same way each time', async () => {
    const { app, asked } = makeApp();
    await request(app).get('/v1/sky?lat=-85&lon=30&date=2025-03-06');
    await request(app).get('/v1/windows?lat=-85&lon=30&start=2025-03-06&days=2');
    expect(asked[0]!.id).toBe(asked[1]!.id);
  });

  it('refuses 95 for latitude with the allowed range (2-2)', async () => {
    const res = await request(makeApp().app).get('/v1/windows?lat=95&lon=10&start=2025-03-06');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ field: 'lat', allowed: '-90 to 90' });
  });
});

describe('new coordinates are limited per visitor per hour (2-3)', () => {
  const limit = { windowMs: 3_600_000, max: 3 };

  it('the request over the limit is refused with a wait time', async () => {
    const { app } = makeApp({ customLimit: limit });
    for (const lat of [-80, -81, -82]) {
      const ok = await request(app).get(`/v1/sky?lat=${lat}&lon=10&date=2025-03-06`);
      expect(ok.status).toBe(200);
    }
    const over = await request(app).get('/v1/sky?lat=-83&lon=10&date=2025-03-06');
    expect(over.status).toBe(429);
    expect(over.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(over.body.error.retryAfterSeconds).toBeLessThanOrEqual(3600);
    expect(over.body.error.message).toMatch(/new coordinates/i);
    expect(over.headers['retry-after']).toBe(String(over.body.error.retryAfterSeconds));
  });

  it('does not count a point the visitor has already added, or the listed sites', async () => {
    const { app } = makeApp({ customLimit: limit });
    for (let i = 0; i < 6; i++) {
      expect((await request(app).get('/v1/sky?lat=-80&lon=10&date=2025-03-06')).status).toBe(200);
      expect((await request(app).get('/v1/windows?lat=-80&lon=10&start=2025-03-06&days=2')).status).toBe(200);
      expect((await request(app).get('/v1/sky?site=im2&date=2025-03-06')).status).toBe(200);
    }
  });

  it('starts again when the hour has passed', async () => {
    let now = 1_000_000;
    const { app } = makeApp({ customLimit: { ...limit, now: () => now } });
    for (const lat of [-80, -81, -82]) await request(app).get(`/v1/sky?lat=${lat}&lon=10&date=2025-03-06`);
    expect((await request(app).get('/v1/sky?lat=-83&lon=10&date=2025-03-06')).status).toBe(429);
    now += 3_600_001;
    expect((await request(app).get('/v1/sky?lat=-83&lon=10&date=2025-03-06')).status).toBe(200);
  });
});
