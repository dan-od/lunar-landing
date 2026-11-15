import { describe, it, expect } from 'vitest';
import { RequestQueue } from '../src/horizons/queue.js';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('RequestQueue (F-2: one request at a time)', () => {
  it('never runs two tasks at once', async () => {
    const queue = new RequestQueue();
    let active = 0;
    let maxActive = 0;
    const task = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await wait(5);
      active--;
      return true;
    };

    await Promise.all(Array.from({ length: 10 }, () => queue.enqueue(task)));
    expect(maxActive).toBe(1);
  });

  it('keeps running after a task rejects', async () => {
    const queue = new RequestQueue();
    const results = await Promise.allSettled([
      queue.enqueue(async () => {
        throw new Error('boom');
      }),
      queue.enqueue(async () => 'ok'),
    ]);
    expect(results[0]!.status).toBe('rejected');
    expect(results[1]).toMatchObject({ status: 'fulfilled', value: 'ok' });
  });
});
