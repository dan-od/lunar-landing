// What happens when a watch is checked. The request handlers (confirm,
// re-check) and the daily job both come through here, so a break is handled
// one way: the watch trips, the log says why, and ONE alert goes out (5-4, 5-5).
import type { SitesRepo } from '../api/providers.js';
import type { Evaluator } from './rules.js';
import type { WatchRepo, WatchRow } from './repo.js';
import type { EmailMessage, EmailSender } from './sender.js';
import { alertEmail, type EmailContext } from './emails.js';
import { maskEmail } from './mask.js';
import { unsubscribeToken } from './tokens.js';

export const DAY_MS = 86_400_000;
/** A confirmation link works for this long. */
export const CONFIRM_TTL_MS = DAY_MS;
/** Hard cap on alert emails for one watch in 24 hours. */
export const MAX_ALERTS_PER_DAY = 5;
/** A failed alert email is tried again this many times. */
export const MAX_SEND_RETRIES = 3;

export interface CheckDeps {
  repo: WatchRepo;
  sender: EmailSender;
  evaluator: Evaluator;
  sitesRepo: SitesRepo;
  /** The clock (epoch ms). */
  now: () => number;
  /** Signs the unsubscribe links. */
  secret: string;
  /** Address of the site, for links in emails. */
  publicSiteUrl: string;
  /** All watch data is removed once the UTC date is past this (YYYY-MM-DD). */
  deleteAfter?: string;
  /** Pause between tries of a failed alert email. */
  retryPauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const siteUrl = (deps: Pick<CheckDeps, 'publicSiteUrl'>): string => deps.publicSiteUrl.replace(/\/+$/, '');

/** What an email about this watch needs to know. */
export async function emailContext(
  deps: Pick<CheckDeps, 'sitesRepo' | 'secret' | 'publicSiteUrl'>,
  watch: WatchRow,
): Promise<EmailContext> {
  const site = await deps.sitesRepo.get(watch.siteId);
  const token = unsubscribeToken(watch.id, watch.manageHash, deps.secret);
  return {
    to: watch.address,
    siteName: site?.name ?? watch.siteId,
    rule: watch.rule,
    scenario: watch.scenario,
    publicSiteUrl: siteUrl(deps),
    unsubscribeUrl: `${siteUrl(deps)}/v1/watches/unsubscribe?token=${token}`,
  };
}

/** Send once. A failure is written to the server log with the address masked, then re-thrown. */
export async function sendOnce(sender: EmailSender, msg: EmailMessage, what: string): Promise<void> {
  try {
    await sender.send(msg);
    console.log(`[watch] ${what} sent to ${maskEmail(msg.to)}`);
  } catch (err) {
    // Only the kind of error is logged: a sender's own words might repeat the address.
    console.warn(`[watch] ${what} to ${maskEmail(msg.to)} was not sent (${err instanceof Error ? err.name : 'error'})`);
    throw err;
  }
}

/**
 * Send the one alert for a break. Respects the daily cap, logs every failure
 * as an event, tries again a limited number of times, then marks it failed.
 */
async function sendAlert(deps: CheckDeps, watch: WatchRow, reason: string): Promise<void> {
  const { repo } = deps;
  const now = deps.now();
  let start = watch.alertWindowStart;
  let count = watch.alertCount;
  if (start === null || now - start >= DAY_MS) {
    start = now;
    count = 0;
  }
  if (count >= MAX_ALERTS_PER_DAY) {
    await repo.addEvent(
      watch.id,
      'INFO',
      `Alert email not sent: this watch has already had ${MAX_ALERTS_PER_DAY} alert emails in 24 hours.`,
      now,
    );
    return;
  }
  await repo.update(watch.id, { alertWindowStart: start, alertCount: count + 1 }, now);

  const msg = alertEmail(await emailContext(deps, watch), reason, now);
  const sleep = deps.sleep ?? realSleep;
  for (let attempt = 0; attempt <= MAX_SEND_RETRIES; attempt++) {
    try {
      await sendOnce(deps.sender, msg, 'alert email');
      await repo.addEvent(watch.id, 'INFO', 'Alert email sent.', deps.now());
      return;
    } catch {
      if (attempt < MAX_SEND_RETRIES) {
        await repo.addEvent(
          watch.id,
          'WARN',
          `The alert email could not be sent. Trying again (${attempt + 1} of ${MAX_SEND_RETRIES}).`,
          deps.now(),
        );
        await sleep(deps.retryPauseMs ?? 1_000);
      } else {
        await repo.addEvent(
          watch.id,
          'FAIL',
          `The alert email could not be sent after ${MAX_SEND_RETRIES + 1} tries. It will not be tried again for this break.`,
          deps.now(),
        );
      }
    }
  }
}

export type CheckOutcome = 'skipped' | 'unknown' | 'unchanged' | 'tripped' | 'cleared';

/**
 * Check one watch against its stored scenario.
 *  - waiting or expired: nothing at all (5-2)
 *  - holding, now broken: tripped, the reason logged as ALERT, one alert email
 *  - broken, now holds: active again, CLEAR logged, no email
 *  - no change: nothing sent
 *  - cannot tell (no positions, no terrain): logged once, nothing changes
 */
export async function checkWatch(deps: CheckDeps, watch: WatchRow, opts: { first?: boolean } = {}): Promise<CheckOutcome> {
  if (watch.status !== 'active' && watch.status !== 'tripped') return 'skipped';
  const { repo } = deps;
  const result = await deps.evaluator.evaluate(watch.siteId, watch.rule, watch.scenario);
  const now = deps.now();
  await repo.update(watch.id, { lastCheckedAt: now }, now);

  if (result.holds === null) {
    const last = (await repo.events(watch.id)).at(-1);
    if (last?.message !== result.reason) await repo.addEvent(watch.id, 'INFO', result.reason, now);
    return 'unknown';
  }
  if (!result.holds && watch.status === 'active') {
    await repo.update(watch.id, { status: 'tripped' }, now);
    await repo.addEvent(watch.id, 'ALERT', result.reason, now);
    await sendAlert(deps, watch, result.reason);
    return 'tripped';
  }
  if (result.holds && watch.status === 'tripped') {
    await repo.update(watch.id, { status: 'active' }, now);
    await repo.addEvent(watch.id, 'CLEAR', 'Rule holds again.', now);
    return 'cleared';
  }
  if (opts.first) await repo.addEvent(watch.id, 'INFO', result.reason, now);
  return 'unchanged';
}

/** True when the UTC date is past the day all watch data is to be removed. */
export function pastDeleteDate(now: number, deleteAfter?: string): boolean {
  return Boolean(deleteAfter) && new Date(now).toISOString().slice(0, 10) > deleteAfter!;
}
