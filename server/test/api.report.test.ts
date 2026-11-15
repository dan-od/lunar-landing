// GET /v1/report (flow 3, 7-2 for report): a verdict and five sentences, each
// marked better, worse or same, built from the same calculator output that
// /v1/windows returns for each side. Data comes from the saved NASA reply.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

describe('GET /v1/report', () => {
  it('builds its sentences from the numbers /v1/windows gives for each side', async () => {
    const app = makeApp();
    // Side A lands at 00:00 (Sun under 2 degrees); side B lands 12 hours later.
    const a = (await request(app).get('/v1/windows?site=im2&start=2025-03-06&hour=0&days=1')).body;
    const b = (await request(app).get('/v1/windows?site=im2&start=2025-03-06&hour=12&days=1')).body;
    const res = await request(app).get(
      '/v1/report?a_site=im2&a_date=2025-03-06&a_hour=0&b_site=im2&b_date=2025-03-06&b_hour=12&days=1',
    );

    expect(res.status).toBe(200);
    expect(res.body.lines.length).toBe(5);
    expect(a.power.uptime_pct).not.toBe(b.power.uptime_pct);
    expect(res.body.lines[0]).toEqual({
      mark: 'better',
      symbol: '▲',
      label: 'Better',
      text: `Time in sunlight goes from ${a.power.uptime_pct}% to ${b.power.uptime_pct}%.`,
    });
    expect(res.body.lines[1].text).toBe(`Earth contact is unchanged at ${a.contact.uptime_pct}%.`);
    expect(res.body.lines[2].text).toBe('Power at landing: Sun down in A, Sun up in B.');
    expect(res.body.lines[3].text).toBe(
      `Longest dark stretch: ${a.power.longest_gap_days.toFixed(1)} days in A, ${b.power.longest_gap_days.toFixed(1)} days in B.`,
    );
    expect(res.body.verdict).toBe('B is the better case');

    // The reply carries each side's numbers and names the scenario and model.
    expect(res.body.a.power.uptime_pct).toBe(a.power.uptime_pct);
    expect(res.body.b.power.uptime_pct).toBe(b.power.uptime_pct);
    expect(res.body.a.state.word).toBe(a.state.word);
    expect(res.body.scenario).toMatchObject({
      a: { site: 'im2', date: '2025-03-06', hour: 0 },
      b: { site: 'im2', date: '2025-03-06', hour: 12 },
      days: 1,
      margin: 2,
    });
    expect(res.body.model).toBe('smooth Moon');
  });

  it('identical sides give "No meaningful change" with every line marked same', async () => {
    const res = await request(makeApp()).get(
      '/v1/report?a_site=im2&a_date=2025-03-06&b_site=im2&b_date=2025-03-06&days=2',
    );
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('No meaningful change');
    expect(res.body.same).toBe(true);
    expect(res.body.note).toMatch(/Moon turns slowly/);
    expect(res.body.lines.every((l: { mark: string }) => l.mark === 'same')).toBe(true);
  });

  it('names the side and field at fault', async () => {
    const app = makeApp();
    const badDate = await request(app).get('/v1/report?a_site=im2&a_date=2025-03-06&b_site=im2&b_date=2050-01-01');
    expect(badDate.status).toBe(400);
    expect(badDate.body.error).toMatchObject({ field: 'b_date', allowed: '2020-01-01 to 2040-12-31' });

    const badLat = await request(app).get('/v1/report?a_lat=95&a_lon=10&a_date=2025-03-06&b_site=im2&b_date=2025-03-06');
    expect(badLat.body.error).toMatchObject({ field: 'a_lat', allowed: '-90 to 90' });

    const missing = await request(app).get('/v1/report?a_site=im2&a_date=2025-03-06&b_date=2025-03-06');
    expect(missing.status).toBe(400);
    expect(missing.body.error.field).toBe('b_site');

    const unknown = await request(app).get('/v1/report?a_site=im2&a_date=2025-03-06&b_site=nowhere&b_date=2025-03-06');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.message).toContain('nowhere');
  });

  it('is rate limited like every other endpoint', async () => {
    const app = makeApp({ rateLimit: { windowMs: 60_000, max: 1 } });
    await request(app).get('/v1/sites');
    const res = await request(app).get('/v1/report?a_site=im2&a_date=2025-03-06&b_site=im2&b_date=2025-03-06');
    expect(res.status).toBe(429);
    expect(res.body.error.retryAfterSeconds).toBeGreaterThan(0);
  });
});
