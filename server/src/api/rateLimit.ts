// A small per-visitor rate limiter (7-3). Fixed window keyed by client IP. When
// the limit is passed it returns 429 with the seconds to wait. In-memory: good
// enough for a single-process homelab deployment.
import type { Request, Response, NextFunction } from 'express';
import { tooManyRequests } from './errors.js';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(opts: RateLimitOptions) {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const t = now();
    let bucket = buckets.get(key);
    if (!bucket || t >= bucket.resetAt) {
      bucket = { count: 0, resetAt: t + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    const remaining = Math.max(0, opts.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(opts.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > opts.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - t) / 1000));
      next(tooManyRequests(retryAfter));
      return;
    }
    next();
  };
}
