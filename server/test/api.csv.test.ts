// 6-1 (a spreadsheet file lists every window) and S-3 (site names are escaped so
// a cell never starts a formula). Data comes from the saved NASA reply.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Site } from '@moon/core';
import { CURATED_SITES } from '@moon/core';
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

const BOM = String.fromCharCode(0xfeff);

/** Split the file into the scenario lines and the data rows under the header. */
function parse(text: string) {
  const lines = text.replace(BOM, '').split('\r\n').filter((l) => l.length > 0);
  const headerAt = lines.findIndex((l) => l.startsWith('"site","kind"'));
  return { preamble: lines.slice(0, headerAt), header: lines[headerAt]!, rows: lines.slice(headerAt + 1) };
}

describe('GET /v1/windows.csv (6-1)', () => {
  it('is a downloadable spreadsheet file', async () => {
    const res = await request(makeApp()).get('/v1/windows.csv?site=im2&start=2025-03-06&days=2');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="moon-status-windows-im2-2025-03-06.csv"',
    );
  });

  it('has one row per window, equal to the windows the JSON endpoint reports', async () => {
    const app = makeApp();
    const q = 'site=im2&start=2025-03-06&days=2&margin=2';
    const json = (await request(app).get(`/v1/windows?${q}`)).body;
    const csv = parse((await request(app).get(`/v1/windows.csv?${q}`)).text);

    expect(csv.header).toBe('"site","kind","start_utc","end_utc","length_hours"');
    expect(csv.rows.length).toBe(json.power.windows.length + json.contact.windows.length);
    expect(csv.rows.filter((r) => r.includes('"power"')).length).toBe(json.power.windows.length);
    expect(csv.rows.filter((r) => r.includes('"contact"')).length).toBe(json.contact.windows.length);

    // Sun clears 2 degrees from 07:00 on 6 March and stays up to the end of the span.
    expect(csv.rows[0]).toBe('"IM-2 target, Mons Mouton","power","2025-03-06 07:00","2025-03-08 00:00",41');
  });

  it('states the scenario and the model in the first lines', async () => {
    const res = await request(makeApp()).get('/v1/windows.csv?site=im2&start=2025-03-06&days=2&margin=2');
    const { preamble } = parse(res.text);
    expect(preamble).toContain('"Site","IM-2 target, Mons Mouton"');
    expect(preamble).toContain('"Landing (UTC)","2025-03-06 00:00"');
    expect(preamble).toContain('"Days",2');
    expect(preamble).toContain('"Shadow allowance (degrees)",2');
    expect(preamble).toContain('"Model","smooth Moon"');
    expect(preamble.some((l) => l.startsWith('"Source","NASA JPL Horizons'))).toBe(true);
  });

  it('follows the landing hour, and matches the JSON endpoint for the same hour', async () => {
    const app = makeApp();
    const q = 'site=im2&start=2025-03-06&hour=9&days=1';
    const json = (await request(app).get(`/v1/windows?${q}`)).body;
    const csv = parse((await request(app).get(`/v1/windows.csv?${q}`)).text);
    expect(json.scenario.hour).toBe(9);
    expect(json.series[0].t).toBe('2025-03-06T09:00:00Z');
    expect(csv.preamble).toContain('"Landing (UTC)","2025-03-06 09:00"');
    expect(csv.rows.length).toBe(json.power.windows.length + json.contact.windows.length);
    expect(csv.rows[0]).toContain('"2025-03-06 09:00"');
  });

  it('names the field at fault, as JSON, when the request is bad', async () => {
    const res = await request(makeApp()).get('/v1/windows.csv?lat=95&lon=10&start=2025-03-06');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ field: 'lat', allowed: '-90 to 90' });
  });
});

describe('site names are escaped in files (S-3)', () => {
  it('a name beginning with an equals sign exports as text', async () => {
    const evil: Site = { ...CURATED_SITES[0]!, id: 'evil', name: '=HYPERLINK("http://example.org","x")' };
    const app = makeApp({ sitesRepo: staticSitesRepo([evil]) });
    const res = await request(app).get('/v1/windows.csv?site=evil&start=2025-03-06&days=2');
    const { preamble, rows } = parse(res.text);

    expect(preamble).toContain('"Site","\'=HYPERLINK(""http://example.org"",""x"")"');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.startsWith('"\'=HYPERLINK(')).toBe(true);
    // No cell anywhere in the file begins with a formula character.
    for (const line of res.text.replace(BOM, '').split('\r\n')) {
      for (const cell of line.split(/,(?=")/)) expect(cell).not.toMatch(/^"\s*[=+\-@]/);
    }
  });

  it('keeps the download file name free of anything from the site name', async () => {
    const odd: Site = { ...CURATED_SITES[0]!, id: 'a"b/../c', name: 'x' };
    const res = await request(makeApp({ sitesRepo: staticSitesRepo([odd]) })).get(
      `/v1/windows.csv?site=${encodeURIComponent(odd.id)}&start=2025-03-06&days=2`,
    );
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="moon-status-windows-a-b-c-2025-03-06.csv"',
    );
  });
});
