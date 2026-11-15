// GET /v1/slip (7-5): ready or not ready for each whole-day slip of the landing
// date. Data comes from the saved NASA reply (2025-03-06 to 03-08), so only the
// slips inside that span have positions; the rest must say so, never guess.
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

interface Slip {
  slip_days: number;
  date: string;
  ready: boolean | null;
  word: string | null;
}

describe('GET /v1/slip (7-5)', () => {
  it('lists every whole-day slip from -30 to +30', async () => {
    const res = await request(makeApp()).get('/v1/slip?site=im2&date=2025-03-06&hour=12');
    expect(res.status).toBe(200);
    const slips = res.body.slips as Slip[];
    expect(slips.length).toBe(61);
    expect(slips[0]).toMatchObject({ slip_days: -30, date: '2025-02-04' });
    expect(slips[30]).toMatchObject({ slip_days: 0, date: '2025-03-06' });
    expect(slips[60]).toMatchObject({ slip_days: 30, date: '2025-04-05' });
    expect(res.body.model).toBe('smooth Moon');
    expect(res.body.scenario).toMatchObject({ site: 'im2', date: '2025-03-06', hour: 12, margin: 2 });
  });

  it('the reply at slip 0 equals the state the sky endpoint gives for the landing moment', async () => {
    const app = makeApp();
    for (const hour of [0, 12]) {
      const sky = (await request(app).get(`/v1/sky?site=im2&date=2025-03-06&hour=${hour}`)).body;
      const slip = (await request(app).get(`/v1/slip?site=im2&date=2025-03-06&hour=${hour}`)).body;
      const zero = (slip.slips as Slip[]).find((s) => s.slip_days === 0)!;
      expect(zero.word).toBe(sky.state.word);
      expect(zero.ready).toBe(sky.state.word === 'READY');
    }
  });

  it('follows the margin', async () => {
    const app = makeApp();
    const at2 = (await request(app).get('/v1/slip?site=im2&date=2025-03-06&hour=0&margin=2')).body;
    const at0 = (await request(app).get('/v1/slip?site=im2&date=2025-03-06&hour=0&margin=0')).body;
    expect((at2.slips as Slip[])[30]!.ready).toBe(false); // Sun at 1.7 degrees, under 2
    expect((at0.slips as Slip[])[30]!.ready).toBe(true);
  });

  it('marks a slip with no saved positions as unknown instead of guessing', async () => {
    const res = await request(makeApp()).get('/v1/slip?site=im2&date=2025-03-06&hour=12');
    const slips = res.body.slips as Slip[];
    expect(slips.find((s) => s.slip_days === 1)).toMatchObject({ ready: true, word: 'READY' }); // 03-07 12:00 is saved
    expect(slips.find((s) => s.slip_days === 10)).toMatchObject({ ready: null, word: null }); // 03-16 is not
    expect(res.body.known).toBe(2);
  });

  it('summarises whether the site is slip-proof for 0 to 14 days, or says it cannot tell', async () => {
    const res = await request(makeApp()).get('/v1/slip?site=im2&date=2025-03-06&hour=12');
    // Days 2 to 14 have no saved positions here, so the answer is unknown.
    expect(res.body.slip_proof_0_to_14).toBeNull();
  });

  it('leaves out dates beyond the allowed range and names bad input', async () => {
    const app = makeApp();
    // A source that has positions for whatever span is asked for.
    const everywhere: SeriesProvider = {
      async get(_site, span) {
        const start = Date.parse(`${span.start.replace(' ', 'T')}:00Z`);
        const stop = Date.parse(`${span.stop.replace(' ', 'T')}:00Z`);
        const rows = (body: 'sun' | 'earth') => {
          const out = [];
          for (let t = start; t <= stop; t += 3_600_000) {
            out.push({ body, time: new Date(t).toISOString().replace('.000Z', 'Z'), azimuthDeg: 90, elevationDeg: 5 });
          }
          return out;
        };
        return { sun: rows('sun'), earth: rows('earth'), saved: true };
      },
    };
    const edge = (await request(makeApp({ seriesProvider: everywhere })).get('/v1/slip?site=im2&date=2100-12-20'))
      .body;
    expect(edge.slip_proof_0_to_14).toBeNull(); // only 12 of the 15 days exist before the last allowed date
    expect((edge.slips as Slip[]).at(-1)).toMatchObject({ slip_days: 11, date: '2100-12-31' });

    const bad = await request(app).get('/v1/slip?site=im2&date=2150-01-01');
    expect(bad.status).toBe(400);
    expect(bad.body.error.field).toBe('date');
    expect((await request(app).get('/v1/slip?site=nowhere&date=2025-03-06')).status).toBe(404);
  });
});
