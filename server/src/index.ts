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

async function shutdown(): Promise<void> {
  stopScheduler?.();
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
