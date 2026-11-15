// The four watch rules read from the same calculator as the API, so the rule,
// the API reply and the assistant tool (which reads the API) cannot disagree.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHorizons } from '../src/horizons/parse.js';
import { createV1Router } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, staticTerrainRepo, type SeriesProvider } from '../src/api/providers.js';
import { im2Terrain, makeEvaluator, skyProvider } from './watchHelpers.js';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
const sun = parseHorizons(read('horizons_sun_im2_2025-03-06_08.txt'), 'sun');
const earth = parseHorizons(read('horizons_earth_im2_2025-03-06_08.txt'), 'earth');
/** The saved NASA reply: real positions, but only 2025-03-06 to 03-08. */
const nasaProvider: SeriesProvider = {
  async get() {
    return { sun, earth, saved: true };
  },
};

function apiOver(seriesProvider: SeriesProvider) {
  const app = express();
  app.use(
    '/v1',
    createV1Router({
      sitesRepo: staticSitesRepo(),
      seriesProvider,
      terrainRepo: staticTerrainRepo({ im2: im2Terrain }),
    }),
  );
  app.use(apiErrorHandler);
  return app;
}

const base = { hour: 12, margin: 2, accuracy: 250 };

describe('watch rules', () => {
  it('7-6: "not slip-proof" agrees with the /v1/slip reply for the same site', async () => {
    const cases = [
      { provider: skyProvider, date: '2025-02-20', expected: true },
      { provider: skyProvider, date: '2025-03-06', expected: false },
      { provider: nasaProvider, date: '2025-03-06', expected: null }, // days 2 to 14 are not saved
    ];
    for (const c of cases) {
      const api = (await request(apiOver(c.provider)).get(`/v1/slip?site=im1&date=${c.date}&hour=12&margin=2`)).body;
      const rule = await makeEvaluator(c.provider).evaluate('im1', 'slip14', { ...base, date: c.date });
      expect(api.slip_proof_0_to_14, c.date).toBe(c.expected);
      expect(rule.holds, c.date).toBe(api.slip_proof_0_to_14);
      expect(rule.model).toBe(api.model);
      expect(rule.reason).toContain('smooth Moon');
    }
    const broken = await makeEvaluator().evaluate('im1', 'slip14', { ...base, date: '2025-03-06' });
    // Not ready from 2025-03-14 12:00 on: slips 8 to 14.
    expect(broken.reason).toContain('7 of the 15');
    expect(broken.reason).toContain('2025-03-14');
  });

  it('F-7: "odds too low" agrees with /v1/miss for the same aim and accuracy', async () => {
    const app = apiOver(nasaProvider);
    const evaluator = makeEvaluator(nasaProvider);
    for (const [east, north] of [
      [0, 0],
      [120, -80],
      [-240, 160],
    ] as const) {
      for (const accuracy of [100, 250, 320]) {
        const api = (
          await request(app).get(
            `/v1/miss?site=im2&date=2025-03-06&hour=8&east=${east}&north=${north}&accuracy=${accuracy}`,
          )
        ).body;
        const line = api.odds.find((o: { accuracy_m: number }) => o.accuracy_m === accuracy);
        const rule = await evaluator.evaluate('im2', 'odds70', {
          date: '2025-03-06',
          hour: 8,
          margin: 2,
          accuracy,
          aim: { east, north },
        });
        expect(rule.holds).toBe(line.out_of_10 >= 7);
        expect(rule.reason).toContain(`${line.out_of_10} in 10`);
        expect(rule.reason).toContain(`${accuracy} m`);
        expect(rule.model).toBe('terrain');
        expect(api.model).toBe('terrain');
      }
    }
    // No aim given means the original target.
    const plain = await evaluator.evaluate('im2', 'odds70', { date: '2025-03-06', hour: 8, margin: 2, accuracy: 250 });
    expect(plain.reason).toContain('on the original target');
    // A site without terrain cannot be answered, and says so instead of guessing.
    const none = await evaluator.evaluate('im1', 'odds70', { date: '2025-03-06', hour: 8, margin: 2, accuracy: 250 });
    expect(none.holds).toBeNull();
  });

  it('"no power at landing" agrees with /v1/windows, on the smooth Moon and on terrain', async () => {
    const app = apiOver(nasaProvider);
    const evaluator = makeEvaluator(nasaProvider);
    for (const hour of [0, 8, 12]) {
      for (const margin of [0, 2, 5]) {
        const api = (await request(app).get(`/v1/windows?site=im2&start=2025-03-06&hour=${hour}&margin=${margin}`)).body;
        const rule = await evaluator.evaluate('im2', 'power', { date: '2025-03-06', hour, margin, accuracy: 250 });
        expect(rule.holds).toBe(api.state.power_up);
        expect(rule.model).toBe('smooth Moon');
        expect(rule.reason).toContain(`${api.series[0].sun_elev.toFixed(1)} degrees`);
      }
    }
    for (const [east, north] of [
      [0, 0],
      [120, -80],
      [-240, 160],
    ] as const) {
      const api = (
        await request(app).get(`/v1/windows?site=im2&start=2025-03-06&hour=8&aim_east=${east}&aim_north=${north}`)
      ).body;
      const rule = await evaluator.evaluate('im2', 'power', {
        date: '2025-03-06',
        hour: 8,
        margin: 2,
        accuracy: 250,
        aim: { east, north },
      });
      expect(rule.holds).toBe(api.state.power_up);
      expect(rule.model).toBe('terrain');
      expect(rule.reason).toContain('terrain');
    }
  });

  it('"contact lost too long" uses the longest gap from /v1/windows over 30 days, and will not guess', async () => {
    const app = apiOver(skyProvider);
    const evaluator = makeEvaluator();
    for (const [date, expected] of [
      ['2025-03-20', false], // Earth is out of view for four days in April
      ['2025-02-01', true],
    ] as const) {
      const api = (await request(app).get(`/v1/windows?site=im1&start=${date}&hour=12&days=30&margin=2`)).body;
      const rule = await evaluator.evaluate('im1', 'link3', { ...base, date });
      expect(rule.holds).toBe(expected);
      expect(rule.holds).toBe(!(api.contact.longest_gap_days > 3));
      expect(rule.reason).toContain(`${api.contact.longest_gap_days.toFixed(1)} days`);
    }
    // Only three of the thirty days are saved here and no long gap is seen in them: unknown.
    const partial = await makeEvaluator(nasaProvider).evaluate('im2', 'link3', { ...base, date: '2025-03-06' });
    expect(partial.holds).toBeNull();
    // An unknown site is unknown too.
    expect((await evaluator.evaluate('nowhere', 'power', { ...base, date: '2025-03-06' })).holds).toBeNull();
  });
});
