// The connector over HTTP: an assistant's client connects to /mcp on the real
// server and gets the API's values; the per-visitor limit applies to it too.
import { describe, it, expect, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseHorizons } from '../src/horizons/parse.js';
import { createApp } from '../src/app.js';
import { staticSitesRepo, type SeriesProvider } from '../src/api/providers.js';
import type { RateLimitOptions } from '../src/api/rateLimit.js';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
const sun = parseHorizons(read('horizons_sun_im2_2025-03-06_08.txt'), 'sun');
const earth = parseHorizons(read('horizons_earth_im2_2025-03-06_08.txt'), 'earth');
const seriesProvider: SeriesProvider = {
  async get() {
    return { sun, earth, saved: true };
  },
};

const servers: Server[] = [];
afterAll(() => {
  for (const s of servers) s.close();
});

async function start(rateLimit?: RateLimitOptions) {
  const app = createApp({ sitesRepo: staticSitesRepo(), seriesProvider, rateLimit });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const client = new Client({ name: 'test-assistant', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  return { app, base, client };
}

const parse = (res: { content?: unknown }) =>
  JSON.parse((res.content as Array<{ text: string }>)[0]!.text) as Record<string, unknown>;

describe('connector served at /mcp', () => {
  it('lists the six tools and answers with the API’s values', async () => {
    const { base, client } = await start();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(6);

    const sites = parse(await client.callTool({ name: 'list_sites', arguments: {} }));
    expect(sites).toEqual(await (await fetch(`${base}/v1/sites`)).json());

    const windows = parse(
      await client.callTool({ name: 'get_windows', arguments: { site: 'im2', date: '2025-03-06', days: 2 } }),
    );
    const direct = (await (await fetch(`${base}/v1/windows?site=im2&start=2025-03-06&days=2`)).json()) as Record<
      string,
      unknown
    >;
    expect(windows.power).toEqual(direct.power);
    expect(windows.model).toBe('smooth Moon');
    await client.close();
  });

  it('applies the per-visitor limit to tool calls', async () => {
    // Connecting and each tool call use requests; a small budget runs out quickly.
    const { client } = await start({ windowMs: 60_000, max: 6 });
    const outcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      try {
        const res = await client.callTool({ name: 'list_sites', arguments: {} });
        outcomes.push(res.isError ? `tool-error:${JSON.stringify(parse(res))}` : 'ok');
      } catch (err) {
        outcomes.push(`refused:${(err as Error).message}`);
      }
    }
    expect(outcomes[0]).toBe('ok');
    expect(outcomes.some((o) => /429|Too many requests/i.test(o))).toBe(true);
  });

  it('refuses anything but POST', async () => {
    const { app } = await start();
    const res = await request(app).get('/mcp');
    expect(res.status).toBe(405);
    expect(res.body.error.message).toMatch(/POST/);
  });
});
