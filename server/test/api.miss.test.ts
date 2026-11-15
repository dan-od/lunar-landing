// GET /v1/miss and terrain-aware windows (flow 4, 7-2 for miss, F-7). Uses the
// real committed terrain profiles and the saved NASA reply; no network.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { latticeCount } from '@moon/core';
import { parseHorizons } from '../src/horizons/parse.js';
import { parseTerrainFile } from '../src/terrain/file.js';
import { createV1Router, type V1Deps } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, staticTerrainRepo, type SeriesProvider } from '../src/api/providers.js';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
const sun = parseHorizons(read('horizons_sun_im2_2025-03-06_08.txt'), 'sun');
const earth = parseHorizons(read('horizons_earth_im2_2025-03-06_08.txt'), 'earth');
const terrain = parseTerrainFile(
  JSON.parse(readFileSync(fileURLToPath(new URL('../../tools/terrain/im2_terrain.json', import.meta.url)), 'utf8')),
);

const fixtureProvider: SeriesProvider = {
  async get() {
    return { sun, earth, saved: true };
  },
};

function makeApp(overrides: Partial<V1Deps> = {}) {
  const app = express();
  app.use(
    '/v1',
    createV1Router({
      sitesRepo: staticSitesRepo(),
      seriesProvider: fixtureProvider,
      terrainRepo: staticTerrainRepo({ im2: terrain }),
      ...overrides,
    }),
  );
  app.use(apiErrorHandler);
  return app;
}

type Cell = [number, number, number];
const inRing = (cells: Cell[], e: number, n: number, r: number) =>
  cells.filter(([ce, cn]) => (ce - e) ** 2 + (cn - n) ** 2 <= r * r);

describe('GET /v1/miss', () => {
  it('returns the terrain model, the scenario, the grid and three odds lines', async () => {
    const res = await request(makeApp()).get('/v1/miss?site=im2&date=2025-03-06&hour=8');
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('terrain');
    expect(res.body.scenario).toMatchObject({
      site: 'im2',
      date: '2025-03-06',
      hour: 8,
      aim: { east: 0, north: 0 },
      accuracy: 250,
    });
    expect(res.body.grid).toMatchObject({ step_m: 40, half_m: 400 });
    expect(res.body.grid.points.length).toBe(441);
    expect(res.body.odds.map((o: { accuracy_m: number }) => o.accuracy_m)).toEqual([100, 250, 320]);
    expect(res.body.aim_text).toBe('on the original target');
  });

  it('each odds line equals the share of working points inside its ring (4-4)', async () => {
    for (const [east, north] of [
      [0, 0],
      [120, -80],
      [-240, 160],
    ]) {
      const res = await request(makeApp()).get(
        `/v1/miss?site=im2&date=2025-03-06&hour=8&east=${east}&north=${north}`,
      );
      expect(res.status).toBe(200);
      const cells = res.body.grid.points as Cell[];
      for (const o of res.body.odds) {
        const inside = inRing(cells, east!, north!, o.accuracy_m);
        const working = inside.filter((c) => c[2] === 1).length;
        expect(o.points).toBe(inside.length);
        expect(o.working).toBe(working);
        expect(o.share).toBeCloseTo(inside.length ? working / inside.length : 0, 12);
        expect(o.out_of_10).toBe(Math.round(o.share * 10));
        expect(o.coverage).toBeCloseTo(inside.length / latticeCount(o.accuracy_m, 40), 12);
      }
    }
  });

  it('the safest aim is at least as good as every other fully covered aim within 300 m (4-5)', async () => {
    const res = await request(makeApp()).get('/v1/miss?site=im2&date=2025-03-06&hour=8&accuracy=250');
    const cells = res.body.grid.points as Cell[];
    const full = latticeCount(250, 40);
    let compared = 0;
    for (const [e, n] of cells) {
      if (Math.hypot(e, n) > 300) continue;
      const inside = inRing(cells, e, n, 250);
      if (inside.length !== full) continue;
      compared++;
      const share = inside.filter((c) => c[2] === 1).length / inside.length;
      expect(res.body.safest.share).toBeGreaterThanOrEqual(share - 1e-12);
    }
    expect(compared).toBeGreaterThan(10);
    expect(Math.hypot(res.body.safest.east, res.body.safest.north)).toBeLessThanOrEqual(300);
  });

  it('gives the same answer for one point as the windows endpoint with that aim (F-7)', async () => {
    const app = makeApp();
    const miss = (await request(app).get('/v1/miss?site=im2&date=2025-03-06&hour=8')).body;
    const cells = miss.grid.points as Cell[];
    for (const [e, n] of [
      [0, 0],
      [200, -120],
      [-240, 160],
    ]) {
      const cell = cells.find((c) => c[0] === e && c[1] === n)!;
      const windows = await request(app).get(
        `/v1/windows?site=im2&start=2025-03-06&hour=8&days=10&aim_east=${e}&aim_north=${n}`,
      );
      expect(windows.status).toBe(200);
      expect(windows.body.model).toBe('terrain');
      expect(windows.body.works).toBe(cell[2] === 1);
      expect(windows.body.horizon.length).toBe(360);
      expect(windows.body.scenario.aim).toEqual({ east: e, north: n });
    }
  });

  it('refuses a site without terrain with 409 and says which sites have it', async () => {
    const res = await request(makeApp()).get('/v1/miss?site=im1&date=2025-03-06');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/No terrain is prepared for IM-1/);
    expect(res.body.error.message).toMatch(/IM-2 target, Mons Mouton \(im2\)/);
  });

  it('refuses an aim that is off the grid or too far, naming the field', async () => {
    const app = makeApp();
    const offGrid = await request(app).get('/v1/miss?site=im2&date=2025-03-06&east=37');
    expect(offGrid.status).toBe(400);
    expect(offGrid.body.error.field).toBe('east');
    expect(offGrid.body.error.allowed).toMatch(/multiples of 40/);

    const tooFar = await request(app).get('/v1/miss?site=im2&date=2025-03-06&east=280&north=280');
    expect(tooFar.status).toBe(400);
    expect(tooFar.body.error.allowed).toMatch(/300 m/);

    const badAccuracy = await request(app).get('/v1/miss?site=im2&date=2025-03-06&accuracy=200');
    expect(badAccuracy.status).toBe(400);
    expect(badAccuracy.body.error).toMatchObject({ field: 'accuracy', allowed: '100, 250 or 320' });
  });

  it('is rate limited', async () => {
    const app = makeApp({ rateLimit: { windowMs: 60_000, max: 1 } });
    await request(app).get('/v1/sites');
    expect((await request(app).get('/v1/miss?site=im2&date=2025-03-06')).status).toBe(429);
  });
});

describe('windows for an aim point', () => {
  it('uses terrain instead of the shadow allowance, and says so', async () => {
    const app = makeApp();
    const smooth = (await request(app).get('/v1/windows?site=im2&start=2025-03-06&days=2&margin=5')).body;
    const onTerrain = (
      await request(app).get('/v1/windows?site=im2&start=2025-03-06&days=2&margin=5&aim_east=0&aim_north=0')
    ).body;
    expect(smooth.model).toBe('smooth Moon');
    expect(smooth.power.uptime_pct).toBe(0); // nothing clears a 5 degree allowance
    expect(onTerrain.model).toBe('terrain');
    expect(onTerrain.power.uptime_pct).toBeGreaterThan(0); // the real horizon is lower than 5 degrees
  });

  it('needs both aim values, and a site with terrain', async () => {
    const app = makeApp();
    const half = await request(app).get('/v1/windows?site=im2&start=2025-03-06&aim_east=40');
    expect(half.status).toBe(400);
    expect(half.body.error.field).toBe('aim_north');
    const none = await request(app).get('/v1/windows?site=ch3&start=2025-03-06&aim_east=0&aim_north=0');
    expect(none.status).toBe(409);
  });

  it('names the terrain model and the aim in the spreadsheet file', async () => {
    const res = await request(makeApp()).get(
      '/v1/windows.csv?site=im2&start=2025-03-06&days=2&aim_east=120&aim_north=-40',
    );
    expect(res.status).toBe(200);
    expect(res.text).toContain('"Model","terrain"');
    expect(res.text).toContain('"Aim","120 m east and 40 m south of the original target"');
  });
});
