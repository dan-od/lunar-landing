// Server entry point.
import { createApp, defaultDeps } from './app.js';
import { config } from './config.js';
import { closePool } from './db/pool.js';
import { createCalc } from './api/calc.js';
import { watchCheckDeps } from './watch/routes.js';
import { startScheduler } from './watch/scheduler.js';

const deps = defaultDeps();
const app = createApp(deps);
const server = app.listen(config.port, () => {
  console.log(`moon-status server listening on :${config.port}`);
});

// The daily watch check runs only when email alerts are switched on. It reads
// through the same calculator as the API, and waits longer between tries of a
// failed alert email than a page request can.
const stopScheduler = deps.watch
  ? startScheduler(watchCheckDeps(createCalc(deps), deps.sitesRepo, { ...deps.watch, retryPauseMs: 30_000 }))
  : undefined;
console.log(`email alerts: ${deps.watch ? 'on' : 'off'}`);

// Trigger terrain preparation: any built-in site without profiles, and any site
// whose map has a newer version, gets a job. The worker computes them one at a
// time. Nothing else recomputes. Failures here never stop the server.
if (deps.terrainJobs) {
  void (async () => {
    try {
      const sites = (await deps.sitesRepo.list()).map((s) => ({
        id: s.id,
        latitude: s.lat,
        longitude: s.lon,
        custom: s.custom,
      }));
      const built = await deps.terrainJobs!.sweepBuiltins(sites);
      const versioned = await deps.terrainJobs!.sweepMapVersions(sites);
      console.log(`terrain jobs queued at startup: ${built} new, ${versioned} for a newer map`);
    } catch (err) {
      console.error('terrain sweep failed:', err);
    }
  })();
}

async function shutdown(): Promise<void> {
  stopScheduler?.();
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
