// Express app factory. Kept separate from the listener so tests can mount it
// without opening a port.
import express, { type Express } from 'express';
import { healthRouter } from './health.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // All application endpoints live under /api.
  app.use('/api', healthRouter);

  return app;
}
