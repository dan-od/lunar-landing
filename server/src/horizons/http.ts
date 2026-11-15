// HTTP for the Horizons client: a per-request timeout and a bounded number of
// retries with increasing waits. Network failures, timeouts, 429 and 5xx are
// retried; other 4xx are not. fetchImpl and sleep are injectable for tests.

export interface FetchLike {
  (url: string, init?: { signal?: AbortSignal }): Promise<{
    status: number;
    text(): Promise<string>;
  }>;
}

export interface HttpOptions {
  /** Abort a single attempt after this many ms. */
  timeoutMs?: number;
  /** Extra attempts after the first (so 3 means up to 4 tries). */
  maxRetries?: number;
  /** First backoff wait; doubles each retry. */
  baseDelayMs?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

export class HorizonsHttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly kind: 'timeout' | 'network' | 'http' = 'http',
  ) {
    super(message);
    this.name = 'HorizonsHttpError';
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchOnce(url: string, timeoutMs: number, fetchImpl: FetchLike) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new HorizonsHttpError(`Horizons request timed out after ${timeoutMs} ms`, undefined, 'timeout');
    }
    throw new HorizonsHttpError(
      `Horizons request failed: ${(err as Error).message}`,
      undefined,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }
}

/** GET a URL with timeout and bounded, increasing-wait retries. Returns the body text. */
export async function horizonsGet(url: string, opts: HttpOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1_000;
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
    try {
      const res = await fetchOnce(url, timeoutMs, fetchImpl);
      if (res.status >= 200 && res.status < 300) {
        return await res.text();
      }
      const httpErr = new HorizonsHttpError(`Horizons responded HTTP ${res.status}`, res.status, 'http');
      if (!retryableStatus(res.status)) throw httpErr; // 4xx (not 429): give up now
      lastError = httpErr;
    } catch (err) {
      // Non-retryable HTTP errors bubble straight up.
      if (err instanceof HorizonsHttpError && err.kind === 'http' && !retryableStatus(err.status ?? 0)) {
        throw err;
      }
      lastError = err; // timeout or network: retry
    }
  }
  throw lastError;
}
