// GET /api/health — liveness and database reachability. Called on 127.0.0.1
// inside the container by the health check (see docker-compose.yml, D-2).
import { Router } from 'express';
import { config } from './config.js';
import { pingDb } from './db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const dbConfigured = Boolean(config.databaseUrl);
  const dbOk = dbConfigured ? await pingDb() : false;
  res.json({
    status: 'ok',
    service: 'moon-status-server',
    db: !dbConfigured ? 'not configured' : dbOk ? 'ok' : 'unreachable',
    time: new Date().toISOString(),
  });
});
