// Express app factory. Kept separate from the listener so tests can mount it
// without opening a port.
import express, { type Express } from 'express';
import { healthRouter } from './health.js';
import { config, watchMode } from './config.js';
import { getPool } from './db/pool.js';
import { createV1Router, type V1Deps } from './api/routes.js';
import { apiErrorHandler, serviceUnavailable } from './api/errors.js';
import { createRateLimiter } from './api/rateLimit.js';
import { createMcpRouter } from './connector/http.js';
import { appSeriesProvider, dbSitesRepo, dbTerrainRepo, staticSitesRepo } from './api/providers.js';
import type { WatchDeps } from './watch/routes.js';
import { pgWatchRepo } from './watch/repo.js';
import { devLogSender, resendSender } from './watch/sender.js';

/** Production wiring: database-backed when a database is configured. */
export function defaultDeps(): V1Deps {
  const pool = getPool();
  const rateLimit = { windowMs: 60_000, max: config.rateLimitPerMinute };
  const customLimit = { windowMs: 3_600_000, max: config.customSitesPerHour };
  if (pool) {
    // Email alerts are on only with both secrets and a database (or, in
    // development, with the sender that only logs). Otherwise they stay off.
    const mode = watchMode(config, true);
    const watch: WatchDeps | undefined =
      mode === 'off'
        ? undefined
        : {
            repo: pgWatchRepo(pool),
            sender: mode === 'fake' ? devLogSender() : resendSender(config.emailSendingKey, config.emailFrom),
            secret: config.tokenSigningSecret,
            publicSiteUrl: config.publicSiteUrl,
            perHour: config.watchesPerHour,
            deleteAfter: config.watchDataDeleteAfter,
          };
    return {
      sitesRepo: dbSitesRepo(pool),
      seriesProvider: appSeriesProvider(pool),
      terrainRepo: dbTerrainRepo(pool),
      rateLimit,
      customLimit,
      watch,
    };
  }
  return {
    sitesRepo: staticSitesRepo(),
    seriesProvider: {
      async get() {
        throw serviceUnavailable('No database is configured, so no positions are saved.');
      },
    },
    rateLimit,
  };
}

export function createApp(deps: V1Deps = defaultDeps()): Express {
  const app = express();
  app.disable('x-powered-by');
  // Behind the client container and the shared proxy: take the visitor address
  // from X-Forwarded-For, trusting only private-range hops.
  app.set('trust proxy', config.trustProxy);
  app.use(express.json());

  app.use('/api', healthRouter);
  app.use('/v1', createV1Router(deps));
  app.use('/v1', (_req, res) => {
    res.status(404).json({ error: { message: 'No such endpoint.' } });
  });

  // The assistant connector, limited per visitor like every other endpoint.
  const mcpLimit = deps.rateLimit ? [createRateLimiter(deps.rateLimit)] : [];
  app.use('/mcp', ...mcpLimit, createMcpRouter());

  app.use(apiErrorHandler);
  return app;
}
