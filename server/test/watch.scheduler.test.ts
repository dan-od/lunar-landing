// The daily watch check, called directly with a clock the test moves. No real
// timers, no real email.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { runDailyCheck } from '../src/watch/scheduler.js';
import type { SeriesProvider } from '../src/api/providers.js';
import {
  ADDRESS,
  DAY,
  HOUR,
  checkDepsFor,
  confirmTokenIn,
  goodWatch,
  makeEvaluator,
  makeWatchApp,
  type Harness,
} from './watchHelpers.js';

const BROKEN = { date: '2025-03-16', hour: 12, margin: 2, accuracy: 250 };

async function create(h: Harness, over: Record<string, unknown> = {}, confirm = true) {
  const res = await request(h.app).post('/v1/watches').send(goodWatch(over));
  expect(res.status).toBe(201);
  if (confirm) {
    const ok = await request(h.app)
      .post('/v1/watches/confirm')
      .send({ token: confirmTokenIn(h.sender.sent.at(-1)!) });
    expect(ok.status).toBe(200);
  }
  return res.body as { id: string; manage_token: string };
}

describe('daily watch check', () => {
  it('5-2: a waiting watch with a broken rule sends nothing, and is marked expired after 24 hours', async () => {
    const h = makeWatchApp();
    const made = await create(h, BROKEN, false);
    h.clock.t += HOUR;
    expect(await runDailyCheck(checkDepsFor(h))).toMatchObject({ expired: 0, checked: 0, tripped: 0 });
    expect((await h.repo.get(made.id))!.status).toBe('pending');

    h.clock.t += DAY;
    expect(await runDailyCheck(checkDepsFor(h))).toMatchObject({ expired: 1, checked: 0, tripped: 0 });
    const row = (await h.repo.get(made.id))!;
    expect(row.status).toBe('expired');
    expect(row.lastCheckedAt).toBeNull();
    expect((await h.repo.events(made.id)).at(-1)!.message).toMatch(/expired/i);
    // Once is enough: the next run does not log it again.
    const before = (await h.repo.events(made.id)).length;
    await runDailyCheck(checkDepsFor(h));
    expect((await h.repo.events(made.id)).length).toBe(before);
    expect(h.sender.sent.length).toBe(1); // the confirmation request only
  });

  it('5-4, 5-5: checks each confirmed watch against its stored scenario and alerts once per break', async () => {
    const h = makeWatchApp();
    const made = await create(h);
    const quiet = await create(h, { site: 'im2', rule: 'link3', date: '2025-02-01' });
    h.clock.t += DAY;
    expect(await runDailyCheck(checkDepsFor(h))).toMatchObject({ checked: 2, tripped: 0, cleared: 0 });
    expect(h.sender.sent.length).toBe(2);
    expect((await h.repo.get(made.id))!.lastCheckedAt).toBe(h.clock.t);

    // The mission slips ten days (the stored scenario changes).
    await h.repo.update(made.id, { scenario: BROKEN });
    h.clock.t += DAY;
    expect(await runDailyCheck(checkDepsFor(h))).toMatchObject({ checked: 2, tripped: 1 });
    expect((await h.repo.get(made.id))!.status).toBe('tripped');
    expect((await h.repo.get(quiet.id))!.status).toBe('active');
    expect(h.sender.sent.length).toBe(3);
    const alert = (await h.repo.events(made.id)).find((e) => e.level === 'ALERT')!;
    expect(h.sender.sent[2]!.text).toContain(alert.message);

    h.clock.t += DAY;
    expect(await runDailyCheck(checkDepsFor(h))).toMatchObject({ checked: 2, tripped: 0 });
    expect(h.sender.sent.length).toBe(3);

    await h.repo.update(made.id, { scenario: { ...BROKEN, date: '2025-03-06' } });
    h.clock.t += DAY;
    expect(await runDailyCheck(checkDepsFor(h))).toMatchObject({ cleared: 1 });
    expect((await h.repo.get(made.id))!.status).toBe('active');
    expect((await h.repo.events(made.id)).at(-1)).toMatchObject({ level: 'CLEAR', message: 'Rule holds again.' });
    expect(h.sender.sent.length).toBe(3);
  });

  it('a check that cannot be answered changes nothing and sends nothing', async () => {
    const h = makeWatchApp();
    const made = await create(h);
    const empty: SeriesProvider = {
      async get() {
        return { sun: [], earth: [], saved: false };
      },
    };
    h.clock.t += DAY;
    await runDailyCheck(checkDepsFor(h, { evaluator: makeEvaluator(empty) }));
    await runDailyCheck(checkDepsFor(h, { evaluator: makeEvaluator(empty) }));
    expect((await h.repo.get(made.id))!.status).toBe('active');
    expect(h.sender.sent.length).toBe(1);
    const notes = (await h.repo.events(made.id)).filter((e) => /could not be checked/i.test(e.message));
    expect(notes.length).toBe(1); // said once, not once per run
  });

  it('a failed send is logged and retried at most 3 times with a pause, then marked failed', async () => {
    const h = makeWatchApp();
    const made = await create(h);
    await h.repo.update(made.id, { scenario: BROKEN });
    const pauses: number[] = [];
    const deps = checkDepsFor(h, { retryPauseMs: 30_000, sleep: async (ms) => void pauses.push(ms) });

    h.sender.failures = 2;
    await runDailyCheck(deps);
    expect(h.sender.sent.length).toBe(2); // the third try got through
    expect(pauses).toEqual([30_000, 30_000]);
    let events = await h.repo.events(made.id);
    expect(events.filter((e) => /trying again/i.test(e.message)).length).toBe(2);
    expect(events.some((e) => e.level === 'FAIL')).toBe(false);

    // Hold again, then break again with the email service down for good.
    await h.repo.update(made.id, { scenario: { ...BROKEN, date: '2025-03-06' } });
    await runDailyCheck(deps);
    await h.repo.update(made.id, { scenario: BROKEN });
    h.sender.failures = 99;
    pauses.length = 0;
    await runDailyCheck(deps);
    expect(h.sender.attempts - h.sender.sent.length).toBe(2 + 4); // 1 try and 3 retries this time
    expect(pauses.length).toBe(3);
    events = await h.repo.events(made.id);
    expect(events.at(-1)).toMatchObject({ level: 'FAIL' });
    expect(events.at(-1)!.message).toMatch(/could not be sent/i);
    expect(JSON.stringify(events)).not.toContain(ADDRESS);
    expect((await h.repo.get(made.id))!.status).toBe('tripped');

    // Still broken on the next run: no further tries for the same break.
    const tries = h.sender.attempts;
    await runDailyCheck(deps);
    expect(h.sender.attempts).toBe(tries);
  });

  it('P-2: removes all watch data once the date is past WATCH_DATA_DELETE_AFTER', async () => {
    const h = makeWatchApp({ watch: { deleteAfter: '2026-12-15' } });
    await create(h);
    await create(h, { site: 'im2' }, false);
    const deps = checkDepsFor(h, { deleteAfter: '2026-12-15' });

    h.clock.t = Date.parse('2026-12-15T23:00:00Z');
    expect(await runDailyCheck(deps)).toMatchObject({ purged: 0 });
    expect(h.repo.size()).toBe(2);

    h.clock.t = Date.parse('2026-12-16T00:10:00Z');
    const sentBefore = h.sender.sent.length;
    expect(await runDailyCheck(deps)).toMatchObject({ purged: 2, checked: 0 });
    expect(h.repo.size()).toBe(0);
    expect(h.repo.dump()).toEqual({ watches: [], events: [] });
    expect(h.sender.sent.length).toBe(sentBefore);

    // Nothing new is taken in after that date.
    const late = await request(h.app).post('/v1/watches').send(goodWatch());
    expect(late.status).toBe(410);
    expect(h.repo.size()).toBe(0);
  });
});
