// 8-1: six read-only tools, each returning the API's own values. 7-6: the
// slip_impact tool reads /v1/slip. Real terrain file and saved NASA reply.
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { parseHorizons } from '../src/horizons/parse.js';
import { parseTerrainFile } from '../src/terrain/file.js';
import { createV1Router } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, staticTerrainRepo, type SeriesProvider } from '../src/api/providers.js';
import { createConnector, TOOL_NAMES, type ApiCall } from '../src/connector/tools.js';

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

const app = express();
app.use(
  '/v1',
  createV1Router({
    sitesRepo: staticSitesRepo(),
    seriesProvider: fixtureProvider,
    terrainRepo: staticTerrainRepo({ im2: terrain }),
  }),
);
app.use(apiErrorHandler);

const paths: string[] = [];
const call: ApiCall = async (path) => {
  paths.push(path);
  const res = await request(app).get(path);
  return { status: res.status, body: res.body };
};
const api = async (path: string) => (await request(app).get(path)).body;

let client: Client;
beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createConnector(call).connect(serverSide);
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientSide);
});

async function run(name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args });
  const content = res.content as Array<{ type: string; text: string }>;
  return { isError: res.isError === true, value: JSON.parse(content[0]!.text) };
}

describe('assistant connector (8-1)', () => {
  it('offers exactly the six read-only tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.description!.length).toBeGreaterThan(40);
    }
    // Nothing that could start or delete a watch.
    expect(tools.some((t) => /watch|delete|create|start/i.test(t.name))).toBe(false);
  });

  it('list_sites returns the API’s sites', async () => {
    expect((await run('list_sites')).value).toEqual(await api('/v1/sites'));
  });

  it('get_windows returns the API’s windows, without the hourly positions', async () => {
    const tool = (await run('get_windows', { site: 'im2', date: '2025-03-06', hour: 0, days: 2 })).value;
    const direct = await api('/v1/windows?site=im2&start=2025-03-06&hour=0&days=2');
    const { series: _s, ...expected } = direct;
    expect(tool).toEqual(expected);
    expect(tool.model).toBe('smooth Moon');
    expect(tool.scenario).toMatchObject({ site: 'im2', start: '2025-03-06' });
  });

  it('compare_sites and change_report return the API’s report', async () => {
    const compare = (await run('compare_sites', { site_a: 'im2', site_b: 'im1', date: '2025-03-06', hour: 0 })).value;
    expect(compare).toEqual(
      await api('/v1/report?a_site=im2&a_date=2025-03-06&a_hour=0&b_site=im1&b_date=2025-03-06&b_hour=0'),
    );
    const change = (
      await run('change_report', {
        a_site: 'im2',
        a_date: '2025-03-06',
        a_hour: 0,
        b_site: 'im2',
        b_date: '2025-03-06',
        b_hour: 12,
      })
    ).value;
    expect(change).toEqual(
      await api('/v1/report?a_site=im2&a_date=2025-03-06&a_hour=0&b_site=im2&b_date=2025-03-06&b_hour=12'),
    );
    expect(change.lines.length).toBe(5);
  });

  it('miss_tolerance returns the API’s odds and safest aim, on the terrain model', async () => {
    const tool = (await run('miss_tolerance', { site: 'im2', date: '2025-03-06', hour: 8, east: 120, north: -80 })).value;
    const direct = await api('/v1/miss?site=im2&date=2025-03-06&hour=8&east=120&north=-80');
    expect(tool.model).toBe('terrain');
    expect(tool.odds).toEqual(direct.odds);
    expect(tool.safest).toEqual(direct.safest);
    expect(tool.scenario).toEqual(direct.scenario);
    expect(tool.grid).toEqual({ step_m: 40, half_m: 400, point_count: 441 });
  });

  it('passes API errors through with the field at fault', async () => {
    const bad = await run('get_windows', { site: 'im2', date: '2050-01-01' });
    expect(bad.isError).toBe(true);
    expect(bad.value.error).toMatchObject({ field: 'start', allowed: '2020-01-01 to 2040-12-31' });

    const noTerrain = await run('miss_tolerance', { site: 'im1', date: '2025-03-06' });
    expect(noTerrain.isError).toBe(true);
    expect(noTerrain.value.error.message).toMatch(/IM-2 target, Mons Mouton \(im2\)/);
  });
});

describe('slip_impact reads /v1/slip (7-6)', () => {
  it('agrees with the slip endpoint for one site', async () => {
    const tool = (await run('slip_impact', { site: 'im2', date: '2025-03-06', hour: 12, slip_days: 1 })).value;
    const direct = await api('/v1/slip?site=im2&date=2025-03-06&hour=12');
    const at = (d: number) => direct.slips.find((x: { slip_days: number }) => x.slip_days === d);
    expect(tool.sites[0]).toMatchObject({
      site: 'im2',
      ready_at_landing: at(0).ready,
      state_at_landing: at(0).word,
      slipped_date: at(1).date,
      ready_after_slip: at(1).ready,
      state_after_slip: at(1).word,
      slip_proof_0_to_14: direct.slip_proof_0_to_14,
    });
    expect(tool.survive).toEqual(at(0).ready && at(1).ready ? ['im2'] : []);
    expect(tool.model).toBe('smooth Moon');
  });

  it('with no site, asks the slip endpoint for every site', async () => {
    paths.length = 0;
    const tool = (await run('slip_impact', { date: '2025-03-06', hour: 12, slip_days: 1 })).value;
    expect(tool.sites.length).toBe(5);
    expect(paths.filter((p) => p.startsWith('/v1/slip')).length).toBe(5);
    expect(tool.scenario).toEqual({ date: '2025-03-06', hour: 12, slip_days: 1, margin: 2 });
  });

  it('reports unknown, not a guess, where no positions are saved', async () => {
    const tool = (await run('slip_impact', { site: 'im2', date: '2025-03-06', hour: 12, slip_days: 10 })).value;
    expect(tool.sites[0].ready_after_slip).toBeNull();
    expect(tool.survive).toEqual([]);
  });
});
