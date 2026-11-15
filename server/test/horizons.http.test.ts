import { describe, it, expect } from 'vitest';
import { horizonsGet, HorizonsHttpError, type FetchLike } from '../src/horizons/http.js';

const ok = (body: string) => ({ status: 200, text: async () => body });
const status = (code: number) => ({ status: code, text: async () => '' });

describe('horizonsGet timeout and retries', () => {
  it('retries on failure with increasing waits, then succeeds', async () => {
    const waits: number[] = [];
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls++;
      if (calls < 3) throw new Error('ECONNRESET');
      return ok('BODY');
    };
    const body = await horizonsGet('u', {
      fetchImpl,
      baseDelayMs: 10,
      maxRetries: 3,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(body).toBe('BODY');
    expect(calls).toBe(3);
    expect(waits).toEqual([10, 20]); // increasing waits before attempts 2 and 3
  });

  it('gives up after the retry budget and throws the last error', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls++;
      return status(503);
    };
    await expect(
      horizonsGet('u', { fetchImpl, maxRetries: 2, baseDelayMs: 1, sleep: async () => {} }),
    ).rejects.toBeInstanceOf(HorizonsHttpError);
    expect(calls).toBe(3); // first try + 2 retries
  });

  it('does not retry a non-retryable 4xx', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls++;
      return status(400);
    };
    await expect(
      horizonsGet('u', { fetchImpl, maxRetries: 5, baseDelayMs: 1, sleep: async () => {} }),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
  });

  it('retries a 429 (too many requests)', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls++;
      return calls < 2 ? status(429) : ok('OK');
    };
    const body = await horizonsGet('u', { fetchImpl, maxRetries: 3, baseDelayMs: 1, sleep: async () => {} });
    expect(body).toBe('OK');
    expect(calls).toBe(2);
  });

  it('times out a slow attempt and reports it as a timeout', async () => {
    // fetchImpl never resolves on its own; it rejects only when aborted.
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    await expect(
      horizonsGet('u', { fetchImpl, timeoutMs: 10, maxRetries: 0 }),
    ).rejects.toMatchObject({ kind: 'timeout' });
  });
});
