// Watch by email (flow 5), under /v1/watches. The only endpoints that store
// personal data or send anything out, so everything is checked before it is
// saved, nothing is sent until the address owner confirms, and every address
// shown or logged is masked.
import { Router, type Request, type Response } from 'express';
import type { Site } from '@moon/core';
import { MISS_RADII } from '@moon/core';
import { ApiError, badRequest, conflict, notFound } from '../api/errors.js';
import { parseDate, parseInteger, parseNumber } from '../api/validate.js';
import type { Calc } from '../api/calc.js';
import type { SitesRepo } from '../api/providers.js';
import { RULES, createEvaluator, isRuleId, modelFor, ruleLabel, type RuleId, type WatchScenario } from './rules.js';
import type { WatchRepo, WatchRow } from './repo.js';
import type { EmailSender } from './sender.js';
import { confirmationEmail, escapeHtml, hasControlChars } from './emails.js';
import { maskEmail } from './mask.js';
import { hashToken, isUnsubscribeTokenFor, newToken, sameHash, unsubscribeTokenId } from './tokens.js';
import { CONFIRM_TTL_MS, DAY_MS, checkWatch, emailContext, pastDeleteDate, sendOnce, type CheckDeps } from './service.js';

export interface WatchDeps {
  repo: WatchRepo;
  sender: EmailSender;
  /** TOKEN_SIGNING_SECRET: keys the stored token hashes. */
  secret: string;
  /** Address of the site, for links in emails. */
  publicSiteUrl: string;
  now?: () => number;
  /** New watches one visitor may start per hour. */
  perHour?: number;
  /** All watch data is removed once the UTC date is past this (YYYY-MM-DD). */
  deleteAfter?: string;
  /** Pause between tries of a failed alert email. */
  retryPauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const PRIVACY_LINE =
  'We keep your address only to send this alert. Delete the watch and it is removed. All watch data is deleted 30 days after the event.';

const OFF_MESSAGE = 'Email alerts are not switched on here.';
const NO_CUSTOM = 'Alerts can only watch a site from the list, not custom coordinates.';
const BAD_EMAIL = 'That email address does not look complete.';
const BAD_CONFIRM = 'That confirmation link is not valid, or it has already been used.';
const EXPIRED_CONFIRM = 'That confirmation link has expired. Ask for a new one from the Watch tab.';

const MAX_WATCHES_PER_ADDRESS = 3;
const MAX_CONFIRM_EMAILS_PER_DAY = 3;
const MAX_TOKENS = 20;

/** What the daily check needs, built from the same pieces the endpoints use. */
export function watchCheckDeps(calc: Calc, sitesRepo: SitesRepo, deps: WatchDeps): CheckDeps {
  return {
    repo: deps.repo,
    sender: deps.sender,
    evaluator: createEvaluator(calc),
    sitesRepo,
    now: deps.now ?? Date.now,
    secret: deps.secret,
    publicSiteUrl: deps.publicSiteUrl,
    deleteAfter: deps.deleteAfter,
    retryPauseMs: deps.retryPauseMs,
    sleep: deps.sleep,
  };
}

const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** A complete, ordinary address: one line, no control characters, at most 254 characters. */
export function parseEmail(v: unknown): string {
  const bad = () => badRequest('email', BAD_EMAIL);
  if (typeof v !== 'string') throw bad();
  if (hasControlChars(v)) throw bad();
  const s = v.trim();
  if (s.length < 6 || s.length > 254 || !EMAIL_RE.test(s)) throw bad();
  const local = s.slice(0, s.lastIndexOf('@'));
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) throw bad();
  return s;
}

/** JSON bodies carry numbers as numbers; the shared parsers read text. */
const asText = (v: unknown): unknown => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : v);
const given = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

/** The scenario fields of a body. `prefix` names the fields in errors ("scenario."). */
function parseScenario(o: Record<string, unknown>, prefix = ''): WatchScenario {
  const f = (name: string) => `${prefix}${name}`;
  const date = parseDate(asText(o.date), f('date'));
  const hour = parseInteger(asText(o.hour), f('hour'), 0, 23, 0);
  const margin = parseNumber(asText(o.margin), f('margin'), 0, 5, 2);
  const accuracy = parseInteger(asText(o.accuracy), f('accuracy'), 0, 100_000, 250);
  if (!MISS_RADII.includes(accuracy)) {
    throw badRequest(f('accuracy'), `${f('accuracy')} must be one of the three lander accuracies.`, MISS_RADII.join(', '));
  }
  const scenario: WatchScenario = { date, hour, margin, accuracy };
  const hasEast = given(o.aim_east);
  const hasNorth = given(o.aim_north);
  if (hasEast || hasNorth) {
    for (const [has, name] of [
      [hasEast, 'aim_east'],
      [hasNorth, 'aim_north'],
    ] as const) {
      if (!has) throw badRequest(f(name), `${f('aim_east')} and ${f('aim_north')} come together.`, '-1000 to 1000');
    }
    scenario.aim = {
      east: parseInteger(asText(o.aim_east), f('aim_east'), -1000, 1000),
      north: parseInteger(asText(o.aim_north), f('aim_north'), -1000, 1000),
    };
  }
  return scenario;
}

/** The scenario as the API shows it. */
const scenarioOut = (s: WatchScenario) => ({
  date: s.date,
  hour: s.hour,
  margin: s.margin,
  accuracy: s.accuracy,
  ...(s.aim ? { aim_east: s.aim.east, aim_north: s.aim.north } : {}),
});

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

const tooMany = (message: string, wait: number) =>
  new ApiError(429, { error: { message, retryAfterSeconds: wait } }, { 'Retry-After': String(wait) });

const forbidden = () =>
  new ApiError(403, { error: { field: 'manage_token', message: 'That watch cannot be changed without its private link.' } });

/** A tiny page for the unsubscribe link: no outside files, no logos, text escaped. */
function unsubscribePage(message: string): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    '<title>Moon Status alerts</title>',
    '<style>body{font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.5;margin:0;padding:48px 24px;background:#fff;color:#111}main{max-width:36em;margin:0 auto}</style>',
    '</head>',
    '<body>',
    `<main><h1>Moon Status alerts</h1><p>${escapeHtml(message)}</p></main>`,
    '</body>',
    '</html>',
  ].join('\n');
}

export function createWatchRouter(calc: Calc, sitesRepo: SitesRepo, deps?: WatchDeps): Router {
  const router = Router();

  // Always answered, so the page can say whether alerts are available here.
  router.get('/config', (_req, res) => {
    res.json({ email_enabled: Boolean(deps), rules: RULES.map((r) => ({ id: r.id, label: r.label })), privacy: PRIVACY_LINE });
  });

  if (!deps) {
    router.use((_req, _res, next) => next(notFound(OFF_MESSAGE)));
    return router;
  }

  const { repo, secret } = deps;
  const check = watchCheckDeps(calc, sitesRepo, deps);
  const now = check.now;
  const perHour = deps.perHour ?? 5;

  const visitorOf = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const bodyOf = (req: Request): Record<string, unknown> =>
    req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};

  // New watches per visitor per hour. In memory, like the request limiter.
  const started = new Map<string, { resetAt: number; count: number }>();
  function allowNewWatch(visitor: string): void {
    const t = now();
    let entry = started.get(visitor);
    if (!entry || t >= entry.resetAt) {
      entry = { resetAt: t + 3_600_000, count: 0 };
      started.set(visitor, entry);
    }
    if (entry.count >= perHour) {
      const wait = Math.max(1, Math.ceil((entry.resetAt - t) / 1000));
      throw tooMany(`Too many new watches. A visitor can start ${perHour} an hour. Try again in ${wait} seconds.`, wait);
    }
    entry.count++;
  }

  // Confirmation emails per address per 24 hours. Kept in memory under a keyed
  // hash of the address, so nothing about an address outlives its watch in the database.
  const confirmSends = new Map<string, number[]>();
  const addressKey = (address: string) => hashToken(address.toLowerCase(), secret);
  function confirmEmailsLeft(address: string): { times: number[]; wait: number } {
    const t = now();
    if (confirmSends.size > 5_000) {
      for (const [k, v] of confirmSends) if (v.every((x) => t - x >= DAY_MS)) confirmSends.delete(k);
    }
    const times = (confirmSends.get(addressKey(address)) ?? []).filter((x) => t - x < DAY_MS);
    const wait =
      times.length >= MAX_CONFIRM_EMAILS_PER_DAY ? Math.max(1, Math.ceil((times[0]! + DAY_MS - t) / 1000)) : 0;
    return { times, wait };
  }
  function checkConfirmEmailCap(address: string): void {
    const { wait } = confirmEmailsLeft(address);
    if (wait > 0) {
      throw tooMany(
        `That address has been sent ${MAX_CONFIRM_EMAILS_PER_DAY} confirmation emails in 24 hours. Try again in ${wait} seconds.`,
        wait,
      );
    }
  }
  function countConfirmEmail(address: string): void {
    const { times } = confirmEmailsLeft(address);
    confirmSends.set(addressKey(address), [...times, now()]);
  }

  /** A curated site from the list, or a plain refusal. */
  async function listedSite(body: Record<string, unknown>): Promise<Site> {
    if (given(body.lat) || given(body.lon)) throw badRequest('site', NO_CUSTOM);
    if (typeof body.site !== 'string' || body.site.length === 0 || body.site.length > 100) {
      throw badRequest('site', 'Choose a site from the list.');
    }
    if (body.site.startsWith('point:')) throw badRequest('site', NO_CUSTOM);
    const site = await sitesRepo.get(body.site);
    if (!site) throw notFound(`No site with id "${body.site.replace(/[^\w:.,-]/g, '')}".`);
    if (site.custom) throw badRequest('site', NO_CUSTOM);
    return site;
  }

  /** Terrain rules need prepared terrain, and an aim must be on its grid. Throws 409 or 400. */
  async function checkFitsSite(site: Site, rule: RuleId, scenario: WatchScenario, prefix = ''): Promise<void> {
    const usesTerrain = rule === 'odds70' || (scenario.aim !== undefined && rule !== 'slip14');
    if (!usesTerrain) return;
    const terrain = await calc.terrainFor(site);
    if (scenario.aim) calc.checkAim(terrain, scenario.aim, `${prefix}aim_east`, `${prefix}aim_north`);
  }

  const shownStatus = (w: WatchRow): string =>
    w.status === 'pending' && w.confirmExpiry !== null && now() > w.confirmExpiry ? 'expired' : w.status;

  async function summary(w: WatchRow) {
    const site = await sitesRepo.get(w.siteId);
    const waiting = w.status === 'pending' || w.status === 'expired';
    return {
      id: w.id,
      site: w.siteId,
      site_name: site?.name ?? w.siteId,
      rule: w.rule,
      rule_label: ruleLabel(w.rule),
      model: modelFor(w.rule, w.scenario),
      status: shownStatus(w),
      address_masked: maskEmail(w.address),
      scenario: scenarioOut(w.scenario),
      created_at: iso(w.createdAt),
      // When the confirmation link stops working; null once confirmed.
      expires_at: waiting ? iso(w.confirmExpiry) : null,
      last_checked_at: iso(w.lastCheckedAt),
      events: (await repo.events(w.id)).map((e) => ({ time: iso(e.time), level: e.level, message: e.message })),
    };
  }

  const fresh = async (id: string): Promise<WatchRow> => {
    const row = await repo.get(id);
    if (!row) throw notFound('That watch has been deleted.');
    return row;
  };

  /** The watches these manage tokens open. Unknown tokens are skipped without a word. */
  async function owned(tokens: unknown): Promise<WatchRow[]> {
    if (!Array.isArray(tokens) || tokens.length > MAX_TOKENS || tokens.some((t) => typeof t !== 'string')) {
      throw badRequest('manage_tokens', 'manage_tokens must be a list of private watch tokens.', `up to ${MAX_TOKENS}`);
    }
    const rows: WatchRow[] = [];
    for (const token of new Set(tokens as string[])) {
      if (token.length < 20 || token.length > 200) continue;
      const hash = hashToken(token, secret);
      const row = await repo.findByManageHash(hash);
      if (row && sameHash(row.manageHash, hash)) rows.push(row);
    }
    return rows;
  }

  /** The watch with this id, only when the manage token is the right one (5-6). */
  async function authorised(req: Request): Promise<WatchRow> {
    const fromHeader = req.get('X-Manage-Token');
    const token = bodyOf(req).manage_token ?? fromHeader;
    const id = req.params.id ?? '';
    if (typeof token !== 'string' || token.length < 20 || token.length > 200 || !/^\d{1,18}$/.test(id)) throw forbidden();
    const row = await repo.get(id);
    // Hash first, then compare in constant time; a missing watch gets the same answer.
    const hash = hashToken(token, secret);
    if (!row || !sameHash(row.manageHash, hash)) throw forbidden();
    return row;
  }

  const CONFIRM_NOT_SENT = 'The confirmation email could not be sent. Use "Send a new link" to try again.';

  /** Issue a new confirmation token and email it. False when the email could not be sent. */
  async function resendConfirmation(w: WatchRow): Promise<boolean> {
    const t = now();
    const token = newToken();
    const expiry = t + CONFIRM_TTL_MS;
    // The old link dies here: only the newest token's hash is kept.
    await repo.update(w.id, { status: 'pending', confirmHash: hashToken(token, secret), confirmExpiry: expiry }, t);
    countConfirmEmail(w.address);
    try {
      await sendOnce(deps!.sender, confirmationEmail(await emailContext(check, w), token, expiry), 'confirmation email');
      await repo.addEvent(w.id, 'INFO', 'New confirmation link sent.', t);
      return true;
    } catch {
      await repo.addEvent(w.id, 'WARN', CONFIRM_NOT_SENT, t);
      return false;
    }
  }

  const SEND_FAILED =
    'We could not send the confirmation email just now. Your watch is saved and waiting. Use "Send a new link" to try again.';

  // POST /v1/watches — start a watch. Everything is checked before anything is saved.
  router.post('/', async (req: Request, res: Response, next) => {
    try {
      const body = bodyOf(req);
      const t = now();
      if (pastDeleteDate(t, deps.deleteAfter)) {
        throw new ApiError(410, { error: { message: 'Email alerts have ended, and all watch data has been deleted.' } });
      }
      const email = parseEmail(body.email);
      if (!isRuleId(body.rule)) {
        throw badRequest('rule', 'rule must be one of the four watch rules.', RULES.map((r) => r.id).join(', '));
      }
      const rule = body.rule;
      const site = await listedSite(body);
      const scenario = parseScenario(body);
      await checkFitsSite(site, rule, scenario);

      if ((await repo.countByAddress(email)) >= MAX_WATCHES_PER_ADDRESS) {
        throw new ApiError(429, {
          error: {
            message: `That address already has ${MAX_WATCHES_PER_ADDRESS} watches. Delete one before starting another.`,
            field: 'email',
          },
        });
      }
      checkConfirmEmailCap(email);
      allowNewWatch(visitorOf(req));

      const manageToken = newToken();
      // The confirmation token is made here so its hash is saved with the watch.
      const confirmToken = newToken();
      const expiry = t + CONFIRM_TTL_MS;
      const watch = await repo.create({
        siteId: site.id,
        scenario,
        rule,
        address: email,
        confirmHash: hashToken(confirmToken, secret),
        confirmExpiry: expiry,
        manageHash: hashToken(manageToken, secret),
        createdAt: t,
      });
      await repo.addEvent(watch.id, 'INFO', 'Watch created. Waiting for confirmation.', t);
      console.log(`[watch] watch ${watch.id} created for ${maskEmail(email)} (${rule}, ${site.id})`);

      const reply = {
        id: watch.id,
        status: 'pending',
        manage_token: manageToken,
        site: site.id,
        site_name: site.name,
        rule,
        rule_label: ruleLabel(rule),
        model: modelFor(rule, scenario),
        address_masked: maskEmail(email),
        expires_at: iso(expiry),
      };

      countConfirmEmail(email);
      try {
        await sendOnce(deps.sender, confirmationEmail(await emailContext(check, watch), confirmToken, expiry), 'confirmation email');
      } catch {
        await repo.addEvent(watch.id, 'WARN', CONFIRM_NOT_SENT, t);
        res.status(502).json({ error: { message: SEND_FAILED }, watch: reply });
        return;
      }
      res.status(201).json(reply);
    } catch (err) {
      next(err);
    }
  });

  // POST /v1/watches/confirm — the address owner confirms. Single use, 24 hours.
  router.post('/confirm', async (req: Request, res: Response, next) => {
    try {
      const token = bodyOf(req).token;
      if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw badRequest('token', BAD_CONFIRM);
      const hash = hashToken(token, secret);
      const found = await repo.findByConfirmHash(hash);
      if (!found || found.confirmHash === null || !sameHash(found.confirmHash, hash)) throw badRequest('token', BAD_CONFIRM);
      if (found.status !== 'pending' && found.status !== 'expired') throw badRequest('token', BAD_CONFIRM);
      const t = now();
      if (found.confirmExpiry === null || t > found.confirmExpiry) {
        if (found.status === 'pending') {
          await repo.update(found.id, { status: 'expired' }, t);
          await repo.addEvent(found.id, 'INFO', 'Confirmation link expired. Send a new link to start the watch.', t);
        }
        throw new ApiError(410, { error: { field: 'token', message: EXPIRED_CONFIRM } });
      }
      // Used up: the hash is cleared, so the same link cannot confirm twice.
      await repo.update(found.id, { status: 'active', confirmHash: null, confirmExpiry: null, confirmedAt: t }, t);
      await repo.addEvent(found.id, 'INFO', 'Watch confirmed.', t);
      console.log(`[watch] watch ${found.id} confirmed by ${maskEmail(found.address)}`);
      // The first check runs at once and may trip the watch.
      await checkWatch(check, await fresh(found.id), { first: true });
      res.json(await summary(await fresh(found.id)));
    } catch (err) {
      next(err);
    }
  });

  // POST /v1/watches/lookup — the watches a browser holds tokens for.
  router.post('/lookup', async (req: Request, res: Response, next) => {
    try {
      const rows = await owned(bodyOf(req).manage_tokens);
      res.json({ watches: await Promise.all(rows.map(summary)) });
    } catch (err) {
      next(err);
    }
  });

  // POST /v1/watches/recheck — the watched scenario changed: store it and check once.
  router.post('/recheck', async (req: Request, res: Response, next) => {
    try {
      const body = bodyOf(req);
      const rows = await owned(body.manage_tokens);
      if (!body.scenario || typeof body.scenario !== 'object' || Array.isArray(body.scenario)) {
        throw badRequest('scenario', 'scenario is required: date, hour, margin, accuracy, and an aim if there is one.');
      }
      const scenario = parseScenario(body.scenario as Record<string, unknown>, 'scenario.');
      // With `site`, only watches on that site take the new scenario.
      const onlySite = typeof body.site === 'string' && body.site.length > 0 ? body.site : undefined;

      const out = [];
      for (const row of rows) {
        const confirmed = row.status === 'active' || row.status === 'tripped';
        if (confirmed && (!onlySite || row.siteId === onlySite)) {
          const site = await sitesRepo.get(row.siteId);
          // A scenario that does not fit this watch's site (no terrain there, aim off its grid) leaves it as it was.
          const fits = site
            ? await checkFitsSite(site, row.rule, scenario, 'scenario.').then(
                () => true,
                (err) => {
                  if (err instanceof ApiError) return false;
                  throw err;
                },
              )
            : false;
          if (fits) {
            await repo.update(row.id, { scenario }, now());
            await checkWatch(check, await fresh(row.id));
          }
        }
        const after = await repo.get(row.id);
        if (after) out.push(await summary(after));
      }
      res.json({ watches: out });
    } catch (err) {
      next(err);
    }
  });

  // GET or POST /v1/watches/unsubscribe?token=… — the one-click way out in every
  // email (RFC 8058). Deletes the watch and its address at once.
  const unsubscribe = async (req: Request, res: Response, next: (err?: unknown) => void) => {
    try {
      const raw = req.query.token;
      const token = typeof raw === 'string' && raw.length >= 20 && raw.length <= 200 ? raw : undefined;
      let row: WatchRow | undefined;
      if (token) {
        const id = unsubscribeTokenId(token);
        if (id) {
          const candidate = await repo.get(id);
          if (candidate && isUnsubscribeTokenFor(token, candidate.id, candidate.manageHash, secret)) row = candidate;
        } else {
          const hash = hashToken(token, secret);
          const candidate = await repo.findByManageHash(hash);
          if (candidate && sameHash(candidate.manageHash, hash)) row = candidate;
        }
      }
      let removed = false;
      if (row) {
        removed = await repo.delete(row.id);
        if (removed) console.log(`[watch] watch ${row.id} unsubscribed and deleted (${maskEmail(row.address)})`);
      }
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Cache-Control', 'no-store');
      res
        .status(200)
        .type('html')
        .send(
          unsubscribePage(
            removed
              ? 'You are unsubscribed. Your address has been deleted.'
              : 'There is nothing to remove. This alert has already been stopped and its address deleted.',
          ),
        );
    } catch (err) {
      next(err);
    }
  };
  router.get('/unsubscribe', unsubscribe);
  router.post('/unsubscribe', unsubscribe);

  // POST /v1/watches/:id/resend — a new confirmation link for a waiting or expired watch (5-3).
  router.post('/:id/resend', async (req: Request, res: Response, next) => {
    try {
      const row = await authorised(req);
      if (row.status !== 'pending' && row.status !== 'expired') {
        throw conflict('This watch is already confirmed, so there is no link to send.');
      }
      checkConfirmEmailCap(row.address);
      const sent = await resendConfirmation(row);
      const after = await summary(await fresh(row.id));
      if (!sent) {
        res.status(502).json({ error: { message: SEND_FAILED }, watch: after });
        return;
      }
      res.json(after);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /v1/watches/:id — needs the private manage token. The row and its events go (P-2).
  router.delete('/:id', async (req: Request, res: Response, next) => {
    try {
      const row = await authorised(req);
      await repo.delete(row.id);
      console.log(`[watch] watch ${row.id} deleted by its owner (${maskEmail(row.address)})`);
      res.json({ deleted: true, id: row.id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
