// Flow 8: the assistant connector. Six read-only tools, each a thin call to the
// public API, so an assistant gets exactly the app's numbers (8-1) and nothing
// the API does not return. It cannot start or delete watches.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/** Calls one of the app's own /v1 endpoints and returns its status and JSON body. */
export type ApiCall = (path: string) => Promise<{ status: number; body: unknown }>;

type Json = Record<string, unknown>;

const text = (value: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.set(k, String(v));
  }
  return q.toString();
}

const site = z.string().describe('Site id from list_sites, for example "im2".');
const date = z.string().describe('Landing date, YYYY-MM-DD (UTC), from 1960-01-01 to 2100-12-31.');
const hour = z.number().int().min(0).max(23).optional().describe('Landing hour (UTC), 0 to 23. Default 0.');
const margin = z
  .number()
  .min(0)
  .max(5)
  .optional()
  .describe('Shadow allowance in degrees, 0 to 5. Default 2. Ignored where terrain is used.');

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

export const TOOL_NAMES = [
  'list_sites',
  'get_windows',
  'compare_sites',
  'slip_impact',
  'miss_tolerance',
  'change_report',
] as const;

export function createConnector(call: ApiCall): McpServer {
  const server = new McpServer({ name: 'moon-status', version: '1.0.0' });

  /** Pass an API reply through; an API error becomes a tool error with the API's own message. */
  const relay = async (path: string, shape: (body: Json) => unknown = (b) => b) => {
    const res = await call(path);
    if (res.status >= 400) return text(res.body, true);
    return text(shape(res.body as Json));
  };

  server.registerTool(
    'list_sites',
    {
      title: 'List landing sites',
      description:
        'The lunar landing sites Moon Status knows, with coordinates, the source of each coordinate, and whether terrain is prepared.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => relay('/v1/sites'),
  );

  server.registerTool(
    'get_windows',
    {
      title: 'Power and contact windows',
      description:
        'For a site and landing moment: when the Sun is up (power) and Earth is in view (contact) over the following days, with uptime, longest gap, next change and the state at landing. Names the model used.',
      inputSchema: {
        site,
        date,
        hour,
        days: z.number().int().min(1).max(60).optional().describe('Days after landing to cover, 1 to 60. Default 30.'),
        margin,
      },
      annotations: READ_ONLY,
    },
    async (a) =>
      relay(`/v1/windows?${query({ site: a.site, start: a.date, hour: a.hour, days: a.days, margin: a.margin })}`, (b) => {
        // The hourly positions are left out to keep the reply short; everything else is as the API gives it.
        const { series: _series, horizon: _horizon, ...rest } = b;
        return rest;
      }),
  );

  server.registerTool(
    'compare_sites',
    {
      title: 'Compare two sites',
      description:
        'Compare two sites for the same landing date and hour: a verdict and five plain sentences, each marked better, worse or same (from the second site’s point of view), plus each site’s numbers.',
      inputSchema: { site_a: site, site_b: site, date, hour, margin },
      annotations: READ_ONLY,
    },
    async (a) =>
      relay(
        `/v1/report?${query({
          a_site: a.site_a,
          a_date: a.date,
          a_hour: a.hour,
          b_site: a.site_b,
          b_date: a.date,
          b_hour: a.hour,
          margin: a.margin,
        })}`,
      ),
  );

  server.registerTool(
    'change_report',
    {
      title: 'Change report between two cases',
      description:
        'Compare any two cases, each with its own site, date and hour (for example the same site ten days later): a verdict and five plain sentences, each marked better, worse or same from case B’s point of view.',
      inputSchema: { a_site: site, a_date: date, a_hour: hour, b_site: site, b_date: date, b_hour: hour, margin },
      annotations: READ_ONLY,
    },
    async (a) =>
      relay(
        `/v1/report?${query({
          a_site: a.a_site,
          a_date: a.a_date,
          a_hour: a.a_hour,
          b_site: a.b_site,
          b_date: a.b_date,
          b_hour: a.b_hour,
          margin: a.margin,
        })}`,
      ),
  );

  server.registerTool(
    'slip_impact',
    {
      title: 'What a schedule slip does',
      description:
        'For one site, or for every site when no site is given: is it ready at the landing moment, and is it still ready if the landing slips by a number of days? Use it for questions such as "which sites survive a 10-day slip?". A value of null means no positions are saved for that day.',
      inputSchema: {
        site: site.optional(),
        date,
        hour,
        slip_days: z.number().int().min(-30).max(30).optional().describe('Whole days of slip, -30 to 30. Default 10.'),
        margin,
      },
      annotations: READ_ONLY,
    },
    async (a) => {
      const slipDays = a.slip_days ?? 10;
      let ids: Array<{ id: string; name: string }>;
      if (a.site) {
        ids = [{ id: a.site, name: a.site }];
      } else {
        const sites = await call('/v1/sites');
        if (sites.status >= 400) return text(sites.body, true);
        ids = ((sites.body as Json).sites as Array<{ id: string; name: string }>).map((s) => ({
          id: s.id,
          name: s.name,
        }));
      }

      const results = [];
      let model: unknown;
      for (const s of ids) {
        const res = await call(`/v1/slip?${query({ site: s.id, date: a.date, hour: a.hour, margin: a.margin })}`);
        if (res.status >= 400) return text(res.body, true);
        const body = res.body as Json;
        model = body.model;
        const slips = body.slips as Array<{ slip_days: number; date: string; ready: boolean | null; word: string | null }>;
        const now = slips.find((x) => x.slip_days === 0);
        const after = slips.find((x) => x.slip_days === slipDays);
        results.push({
          site: s.id,
          name: s.name,
          ready_at_landing: now?.ready ?? null,
          state_at_landing: now?.word ?? null,
          slipped_date: after?.date ?? null,
          ready_after_slip: after?.ready ?? null,
          state_after_slip: after?.word ?? null,
          slip_proof_0_to_14: body.slip_proof_0_to_14 ?? null,
        });
      }
      return text({
        model,
        source: 'JPL Horizons',
        scenario: { date: a.date, hour: a.hour ?? 0, slip_days: slipDays, margin: a.margin ?? 2 },
        // Sites that are ready both at the landing moment and after the slip.
        survive: results.filter((r) => r.ready_at_landing === true && r.ready_after_slip === true).map((r) => r.site),
        sites: results,
      });
    },
  );

  server.registerTool(
    'miss_tolerance',
    {
      title: 'What if the landing misses?',
      description:
        'On real terrain, how many landings out of 10 would work if the lander comes down within 100, 250 or 320 metres of where it aims, and the safest place to aim nearby. Only for sites with prepared terrain; other sites return an error saying which sites have it.',
      inputSchema: {
        site,
        date,
        hour,
        east: z.number().int().optional().describe('Aim offset east of the target in metres (a multiple of the grid step). Default 0.'),
        north: z.number().int().optional().describe('Aim offset north of the target in metres. Default 0.'),
        accuracy: z.number().int().optional().describe('Lander accuracy in metres: 100, 250 or 320. Default 250.'),
      },
      annotations: READ_ONLY,
    },
    async (a) =>
      relay(
        `/v1/miss?${query({ site: a.site, date: a.date, hour: a.hour, east: a.east, north: a.north, accuracy: a.accuracy })}`,
        (b) => {
          // The per-point grid is left out to keep the reply short; its size is kept.
          const grid = b.grid as { step_m: number; half_m: number; points: unknown[] };
          return { ...b, grid: { step_m: grid.step_m, half_m: grid.half_m, point_count: grid.points.length } };
        },
      ),
  );

  return server;
}
