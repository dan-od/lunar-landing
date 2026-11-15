// S-2: addresses are masked in logs. Everything the server writes to the
// console, to the event log or into a reply is searched for the address.
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { runDailyCheck } from '../src/watch/scheduler.js';
import { devLogSender, type EmailSender } from '../src/watch/sender.js';
import { ADDRESS, checkDepsFor, goodWatch, makeWatchApp } from './watchHelpers.js';

afterEach(() => vi.restoreAllMocks());

describe('S-2: no full email address in any log line, event or reply', () => {
  it('create, confirm, alert and failure paths write only the masked address', async () => {
    const out: string[] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        out.push(
          args
            .map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a)))
            .join(' '),
        );
      });
    }
    const replies: string[] = [];

    // A sender that logs like the developer one, and fails on demand the way a real one might.
    let failing = false;
    const logging = devLogSender();
    const sender: EmailSender = {
      async send(msg) {
        if (failing) throw new Error(`mailbox ${msg.to} rejected the message`);
        await logging.send(msg);
      },
    };
    const h = makeWatchApp({ watch: { sender } });
    const post = async (path: string, body: object) => {
      const res = await request(h.app).post(path).send(body);
      replies.push(JSON.stringify(res.body));
      return res;
    };

    // Create, confirm (the developer sender logs the link), then trip it.
    const made = await post('/v1/watches', goodWatch());
    expect(made.status).toBe(201);
    const link = out.join('\n').match(/confirm=([A-Za-z0-9_-]+)/);
    expect(link).not.toBeNull();
    expect((await post('/v1/watches/confirm', { token: link![1] })).status).toBe(200);
    const broken = { date: '2025-03-16', hour: 12, margin: 2, accuracy: 250 };
    const holding = { ...broken, date: '2025-03-06' };
    await post('/v1/watches/recheck', { manage_tokens: [made.body.manage_token], scenario: broken });

    // Failure paths: a confirmation and an alert that cannot be sent, by request and by the daily check.
    failing = true;
    expect((await post('/v1/watches', goodWatch({ site: 'im2' }))).status).toBe(502);
    await post('/v1/watches/recheck', { manage_tokens: [made.body.manage_token], scenario: holding });
    await post('/v1/watches/recheck', { manage_tokens: [made.body.manage_token], scenario: broken });
    await h.repo.update(made.body.id, { scenario: holding });
    await runDailyCheck(checkDepsFor(h, { sender }));
    await h.repo.update(made.body.id, { scenario: broken });
    await runDailyCheck(checkDepsFor(h, { sender }));
    // Refusals.
    await post('/v1/watches', goodWatch({ email: `${ADDRESS}\n` }));
    await post('/v1/watches', goodWatch({ rule: 'nope' }));

    const logged = out.join('\n');
    expect(logged).toContain('d•••@example.org'); // something was logged, and masked
    expect(logged).not.toContain(ADDRESS);
    expect(logged).not.toContain('dana.tester');
    expect(replies.join('\n')).not.toContain('dana.tester');
    const events = h.repo.dump().events;
    expect(events.some((e) => e.level === 'FAIL')).toBe(true);
    expect(JSON.stringify(events)).not.toContain('dana.tester');
  });
});
