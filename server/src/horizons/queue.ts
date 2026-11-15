// A one-at-a-time request queue. NASA's fair-use policy requires that only one
// outbound Horizons request be in flight at any time (F-2).
export class RequestQueue {
  private tail: Promise<unknown> = Promise.resolve();

  /** Run `fn` after every previously enqueued task has settled. */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    // Keep the chain going whether this task resolved or rejected.
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
