// Server entry point.
import { createApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db/pool.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`moon-status server listening on :${config.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
