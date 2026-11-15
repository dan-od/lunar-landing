// 6-2: a calendar file lists the upcoming changes (sunrise, sunset, Earth rise,
// Earth set) for the Watch tab, each with a reminder, from the same calculator.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { changesFrom, computeResult } from '@moon/core';
import { parseHorizons } from '../src/horizons/parse.js';
import { createV1Router } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, type SeriesProvider } from '../src/api/providers.js';

const read = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
const sun = parseHorizons(read('horizons_sun_im2_2025-03-06_08.txt'), 'sun');
const earth = parseHorizons(read('horizons_earth_im2_2025-03-06_08.txt'), 'earth');
const provider: SeriesProvider = {
  async get() {
    return { sun, earth, saved: true };
  },
};

function makeApp() {
  const app = express();
  app.use('/v1', createV1Router({ sitesRepo: staticSitesRepo(), seriesProvider: provider }));
  app.use(apiErrorHandler);
  return app;
}

const unfold = (s: string) => s.replace(/\r\n /g, '');
const Q = 'site=im2&start=2025-03-06&hour=0&days=2&margin=2';

describe('GET /v1/windows.ics (6-2)', () => {
  it('lists every upcoming change from the calculator, each with a reminder, and names the model', async () => {
    const res = await request(makeApp()).get(`/v1/windows.ics?${Q}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="moon-status-changes-im2-2025-03-06\.ics"/);
    const text = unfold(res.text);

    // The same changes the Watch tab lists, from the same calculator.
    const start = Date.parse('2025-03-06T00:00:00Z');
    const inSpan = (r: { time: string }) => Date.parse(r.time) < start + 48 * 3_600_000;
    const result = computeResult(sun.filter(inSpan), earth.filter(inSpan), { marginDeg: 2 });
    const changes = changesFrom(result, '2025-03-06T00:00:00Z', 48);
    expect(changes.length).toBeGreaterThan(0);
    expect(text.match(/BEGIN:VEVENT/g)?.length).toBe(changes.length);
    expect(text.match(/BEGIN:VALARM/g)?.length).toBe(changes.length);
    expect(text).toContain('Smooth-Moon model');
    expect(text).toContain('IM-2 target\\, Mons Mouton');
  });

  it('gives one change on its own when asked for its time and kind', async () => {
    const all = unfold((await request(makeApp()).get(`/v1/windows.ics?${Q}`)).text);
    const first = /DTSTART:(\d{8}T\d{6}Z)[\s\S]*?SUMMARY:(Sunrise|Sunset|Earth rise|Earth set)/.exec(all)!;
    const at = first[1]!.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
    const kind = { Sunrise: 'sunrise', Sunset: 'sunset', 'Earth rise': 'earthrise', 'Earth set': 'earthset' }[first[2]!];
    const one = await request(makeApp()).get(`/v1/windows.ics?${Q}&at=${at}&kind=${kind}&remind=30`);
    expect(one.status).toBe(200);
    expect(unfold(one.text).match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(one.text).toContain('TRIGGER:-PT30M');
  });

  it('names the field at fault', async () => {
    const badKind = await request(makeApp()).get(`/v1/windows.ics?${Q}&at=2025-03-06T05:00:00Z&kind=noon`);
    expect(badKind.status).toBe(400);
    expect(badKind.body.error).toMatchObject({ field: 'kind' });
    const none = await request(makeApp()).get(`/v1/windows.ics?${Q}&at=2025-03-06T05:30:00Z&kind=sunrise`);
    expect(none.status).toBe(404);
    const remind = await request(makeApp()).get(`/v1/windows.ics?${Q}&remind=5000`);
    expect(remind.body.error).toMatchObject({ field: 'remind' });
  });
});
