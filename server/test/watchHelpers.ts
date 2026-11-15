// Shared setup for the watch tests: an in-memory store, a sender that only
// records, made-up positions and a clock the test moves by hand. Nothing here
// touches the network, a database or a real timer.
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createV1Router, type V1Deps } from '../src/api/routes.js';
import { apiErrorHandler } from '../src/api/errors.js';
import { staticSitesRepo, staticTerrainRepo, type SeriesProvider } from '../src/api/providers.js';
import { parseTerrainFile } from '../src/terrain/file.js';
import { MemoryWatchRepo } from '../src/watch/repo.js';
import { FakeSender, type EmailMessage } from '../src/watch/sender.js';
import type { WatchDeps } from '../src/watch/routes.js';
import { createCalc } from '../src/api/calc.js';
import { createEvaluator } from '../src/watch/rules.js';
import type { CheckDeps } from '../src/watch/service.js';

export const ADDRESS = 'dana.tester@example.org';
export const SECRET = 'test-only-signing-secret';
export const SITE_URL = 'https://moon.example.test';
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** The Sun sets for good at this moment in the made-up sky. */
export const SUNSET = Date.parse('2025-03-14T00:00:00Z');
/** Earth is out of view between these two moments (four days). */
export const EARTH_GONE = [Date.parse('2025-04-01T00:00:00Z'), Date.parse('2025-04-05T00:00:00Z')] as const;

/** Positions for whatever span is asked for: Sun up until SUNSET, Earth up except in EARTH_GONE. */
export const skyProvider: SeriesProvider = {
  async get(_site, span) {
    const start = Date.parse(`${span.start.replace(' ', 'T')}:00Z`);
    const stop = Date.parse(`${span.stop.replace(' ', 'T')}:00Z`);
    const rows = (body: 'sun' | 'earth') => {
      const out = [];
      for (let t = start; t <= stop; t += HOUR) {
        const up = body === 'sun' ? t < SUNSET : t < EARTH_GONE[0] || t >= EARTH_GONE[1];
        out.push({
          body,
          time: new Date(t).toISOString().replace('.000Z', 'Z'),
          azimuthDeg: 90,
          elevationDeg: up ? 5 : -3,
        });
      }
      return out;
    };
    return { sun: rows('sun'), earth: rows('earth'), saved: true };
  },
};

export const im2Terrain = parseTerrainFile(
  JSON.parse(readFileSync(fileURLToPath(new URL('../../tools/terrain/im2_terrain.json', import.meta.url)), 'utf8')),
);

export interface Harness {
  app: express.Express;
  repo: MemoryWatchRepo;
  sender: FakeSender;
  /** The clock. Move it with `clock.t += ...`. */
  clock: { t: number };
  watch: WatchDeps;
}

export function makeWatchApp(opts: { watch?: Partial<WatchDeps>; v1?: Partial<V1Deps>; off?: boolean } = {}): Harness {
  const repo = new MemoryWatchRepo();
  const sender = new FakeSender();
  const clock = { t: Date.parse('2026-11-01T09:00:00Z') };
  const watch: WatchDeps = {
    repo,
    sender,
    secret: SECRET,
    publicSiteUrl: SITE_URL,
    now: () => clock.t,
    sleep: async () => {},
    ...opts.watch,
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/v1',
    createV1Router({
      sitesRepo: staticSitesRepo(),
      seriesProvider: skyProvider,
      terrainRepo: staticTerrainRepo({ im2: im2Terrain }),
      ...(opts.off ? {} : { watch }),
      ...opts.v1,
    }),
  );
  app.use(apiErrorHandler);
  return { app, repo, sender, clock, watch };
}

/** An evaluator over the same made-up sky (or another source of positions). */
export const makeEvaluator = (seriesProvider: SeriesProvider = skyProvider) =>
  createEvaluator(
    createCalc({ sitesRepo: staticSitesRepo(), seriesProvider, terrainRepo: staticTerrainRepo({ im2: im2Terrain }) }),
  );

/** What the daily check needs, sharing the harness's store, sender and clock. */
export function checkDepsFor(h: Harness, over: Partial<CheckDeps> = {}): CheckDeps {
  return {
    repo: h.repo,
    sender: h.sender,
    evaluator: makeEvaluator(),
    sitesRepo: staticSitesRepo(),
    now: () => h.clock.t,
    secret: SECRET,
    publicSiteUrl: SITE_URL,
    sleep: async () => {},
    ...over,
  };
}

/** A watch request that holds at first: the Sun is up on 2025-03-06 in the made-up sky. */
export const goodWatch = (over: Record<string, unknown> = {}) => ({
  site: 'im1',
  date: '2025-03-06',
  hour: 12,
  margin: 2,
  accuracy: 250,
  rule: 'power',
  email: ADDRESS,
  ...over,
});

export const confirmTokenIn = (msg: EmailMessage): string => {
  const m = /[?&]confirm=([A-Za-z0-9_-]+)/.exec(msg.text);
  if (!m) throw new Error('no confirmation link in the message');
  return m[1]!;
};

export const unsubscribeUrlIn = (msg: EmailMessage): URL => {
  const m = /<([^>]+)>/.exec(msg.headers?.['List-Unsubscribe'] ?? '');
  if (!m) throw new Error('no List-Unsubscribe header in the message');
  return new URL(m[1]!);
};
