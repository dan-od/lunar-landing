// API errors. Every error reply names the field at fault and the allowed range
// where there is one (7-4).
import type { Request, Response, NextFunction } from 'express';

export interface ApiErrorBody {
  error: {
    message: string;
    field?: string;
    allowed?: string;
    retryAfterSeconds?: number;
    saved?: boolean;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
    public readonly headers?: Record<string, string>,
  ) {
    super(body.error.message);
    this.name = 'ApiError';
  }
}

export const badRequest = (field: string, message: string, allowed?: string) =>
  new ApiError(400, { error: { field, message, allowed } });

export const notFound = (message: string) => new ApiError(404, { error: { message } });

export const tooManyRequests = (retryAfterSeconds: number) =>
  new ApiError(
    429,
    { error: { message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`, retryAfterSeconds } },
    { 'Retry-After': String(retryAfterSeconds) },
  );

export const serviceUnavailable = (message: string, saved = false) =>
  new ApiError(503, { error: { message, saved } });

/** Express error handler that renders ApiError as JSON and hides everything else. */
export function apiErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.headers) for (const [k, v] of Object.entries(err.headers)) res.setHeader(k, v);
    res.status(err.status).json(err.body);
    return;
  }
  // Unexpected: do not leak internals.
  res.status(500).json({ error: { message: 'Internal error' } });
}
