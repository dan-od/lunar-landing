// The daily watch check (5-4). `runDailyCheck` is a plain function over its
// dependencies, so tests call it with a clock they control; `startScheduler`
// is the thin timer around it that the server starts when alerts are on.
import { DAY_MS, checkWatch, pastDeleteDate, type CheckDeps } from './service.js';

export interface DailyCheckResult {
  /** Waiting watches whose confirmation link ran out and are now marked expired. */
  expired: number;
  /** Confirmed watches checked. */
  checked: number;
  tripped: number;
  cleared: number;
  /** Checks that could not be answered (no saved positions, no terrain). */
  unknown: number;
  /** Watches removed because the date is past WATCH_DATA_DELETE_AFTER. */
  purged: number;
}

/**
 * One pass: remove everything if the keep-until date has passed (P-2);
 * otherwise mark old waiting watches expired and check every confirmed watch
 * against its stored scenario. Waiting watches are never evaluated (5-2).
 */
export async function runDailyCheck(deps: CheckDeps): Promise<DailyCheckResult> {
  const { repo } = deps;
  const result: DailyCheckResult = { expired: 0, checked: 0, tripped: 0, cleared: 0, unknown: 0, purged: 0 };
  const now = deps.now();

  if (pastDeleteDate(now, deps.deleteAfter)) {
    result.purged = await repo.deleteAll();
    if (result.purged > 0) {
      console.log(`[watch] removed all watch data (${result.purged} watches): the date is past ${deps.deleteAfter}`);
    }
    return result;
  }

  for (const w of await repo.listByStatus(['pending'])) {
    if (w.confirmExpiry !== null && now > w.confirmExpiry) {
      await repo.update(w.id, { status: 'expired' }, now);
      await repo.addEvent(w.id, 'INFO', 'Confirmation link expired. Send a new link to start the watch.', now);
      result.expired++;
    }
  }

  for (const w of await repo.listByStatus(['active', 'tripped'])) {
    try {
      const outcome = await checkWatch(deps, w);
      result.checked++;
      if (outcome === 'tripped') result.tripped++;
      else if (outcome === 'cleared') result.cleared++;
      else if (outcome === 'unknown') result.unknown++;
    } catch (err) {
      // One watch failing must not stop the rest. Only the kind of error is logged.
      console.error(`[watch] daily check of watch ${w.id} did not finish (${err instanceof Error ? err.name : 'error'})`);
    }
  }
  return result;
}

export interface SchedulerOptions {
  /** Wait before the first run after the server starts. */
  firstDelayMs?: number;
  /** Time between runs. */
  intervalMs?: number;
}

/** Run the check shortly after start and then once a day. Returns a function that stops it. */
export function startScheduler(deps: CheckDeps, opts: SchedulerOptions = {}): () => void {
  let running = false;
  const run = async () => {
    if (running) return; // never two passes at once
    running = true;
    try {
      const r = await runDailyCheck(deps);
      console.log(
        `[watch] daily check: ${r.checked} checked, ${r.tripped} tripped, ${r.cleared} cleared, ${r.unknown} not answered, ${r.expired} expired, ${r.purged} removed`,
      );
    } catch (err) {
      console.error(`[watch] daily check did not finish (${err instanceof Error ? err.name : 'error'})`);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(() => void run(), opts.firstDelayMs ?? 60_000);
  const every = setInterval(() => void run(), opts.intervalMs ?? DAY_MS);
  // The timers must not keep the process alive on their own.
  first.unref();
  every.unref();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
