// Watch by email (flow 5): create, confirm, re-check, delete, unsubscribe and
// the limits. A fake sender records every message; nothing is really sent.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import {
  ADDRESS,
  DAY,
  HOUR,
  SITE_URL,
  confirmTokenIn,
  goodWatch,
  makeWatchApp,
  unsubscribeUrlIn,
  type Harness,
} from './watchHelpers.js';

const PRIVACY =
  'We keep your address only to send this alert. Delete the watch and it is removed. All watch data is deleted 30 days after the event.';

async function createWatch(h: Harness, over: Record<string, unknown> = {}) {
  const res = await request(h.app).post('/v1/watches').send(goodWatch(over));
  expect(res.status).toBe(201);
  return res.body as { id: string; manage_token: string; status: string };
}

async function createConfirmed(h: Harness, over: Record<string, unknown> = {}) {
  const made = await createWatch(h, over);
  const token = confirmTokenIn(h.sender.sent.at(-1)!);
  const res = await request(h.app).post('/v1/watches/confirm').send({ token });
  expect(res.status).toBe(200);
  return made;
}

const lookup = async (h: Harness, ...tokens: string[]) =>
  (await request(h.app).post('/v1/watches/lookup').send({ manage_tokens: tokens })).body.watches as Array<{
    id: string;
    status: string;
    scenario: Record<string, unknown>;
    last_checked_at: string | null;
    events: Array<{ time: string; level: string; message: string }>;
  }>;

const recheck = (h: Harness, tokens: string[], scenario: Record<string, unknown>) =>
  request(h.app).post('/v1/watches/recheck').send({ manage_tokens: tokens, scenario });

const BROKEN = { date: '2025-03-16', hour: 12, margin: 2, accuracy: 250 }; // ten days later: the Sun has set
const HOLDING = { date: '2025-03-06', hour: 12, margin: 2, accuracy: 250 };

describe('watch endpoints when email alerts are off', () => {
  it('config says disabled, every other endpoint answers 404 and nothing is sent', async () => {
    const h = makeWatchApp({ off: true });
    const config = await request(h.app).get('/v1/watches/config');
    expect(config.status).toBe(200);
    expect(config.body.email_enabled).toBe(false);
    expect(config.body.privacy).toBe(PRIVACY);

    const post = await request(h.app).post('/v1/watches').send(goodWatch());
    expect(post.status).toBe(404);
    expect(post.body).toEqual({ error: { message: 'Email alerts are not switched on here.' } });
    for (const [method, path] of [
      ['post', '/v1/watches/confirm'],
      ['post', '/v1/watches/lookup'],
      ['post', '/v1/watches/recheck'],
      ['post', '/v1/watches/1/resend'],
      ['delete', '/v1/watches/1'],
      ['get', '/v1/watches/unsubscribe?token=x'],
      ['post', '/v1/watches/unsubscribe?token=x'],
    ] as const) {
      expect((await request(h.app)[method](path).send({})).status, path).toBe(404);
    }
    expect(h.sender.sent).toEqual([]);
    expect(h.repo.size()).toBe(0);
  });
});

describe('GET /v1/watches/config', () => {
  it('lists the four rules and the privacy line (P-1)', async () => {
    const res = await request(makeWatchApp().app).get('/v1/watches/config');
    expect(res.body).toEqual({
      email_enabled: true,
      rules: [
        { id: 'power', label: 'No power at landing' },
        { id: 'link3', label: 'Contact lost too long' },
        { id: 'slip14', label: 'Not slip-proof' },
        { id: 'odds70', label: 'Odds too low' },
      ],
      privacy: PRIVACY,
    });
  });
});

describe('POST /v1/watches', () => {
  it('5-1: saves the watch as waiting and sends one confirmation email with a link', async () => {
    const h = makeWatchApp();
    const res = await request(h.app).post('/v1/watches').send(goodWatch());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'pending',
      site: 'im1',
      rule: 'power',
      rule_label: 'No power at landing',
      address_masked: 'd•••@example.org',
      expires_at: new Date(h.clock.t + DAY).toISOString(),
    });
    expect(typeof res.body.manage_token).toBe('string');
    expect(JSON.stringify(res.body)).not.toContain(ADDRESS);

    expect(h.sender.sent.length).toBe(1);
    const mail = h.sender.sent[0]!;
    expect(mail.to).toBe(ADDRESS);
    expect(mail.text).toContain(`${SITE_URL}/watch?confirm=`);
    expect(mail.text).toContain('smooth Moon');
    expect(mail.text).toContain('2025-03-06 12:00 UTC');
    expect(mail.text).toContain('We keep your address only to send this alert. Unsubscribe and it is deleted.');

    const [shown] = await lookup(h, res.body.manage_token);
    expect(shown).toMatchObject({ id: res.body.id, status: 'pending', last_checked_at: null });
    expect(shown!.events.map((e) => e.message)).toEqual(['Watch created. Waiting for confirmation.']);
    // Tokens are stored only as keyed hashes.
    const row = (await h.repo.get(res.body.id))!;
    expect(row.manageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(res.body.manage_token);
    expect(JSON.stringify(row)).not.toContain(confirmTokenIn(mail));
  });

  it('refuses a bad email address, names the field, and saves nothing', async () => {
    const h = makeWatchApp();
    for (const email of [
      '',
      'dana',
      'dana@',
      '@example.org',
      'dana@example',
      'dana tester@example.org',
      'dana@example.org\nBcc: other@example.org',
      'dana@exam\u0000ple.org',
      `${'a'.repeat(250)}@example.org`,
      42,
      undefined,
    ]) {
      const res = await request(h.app).post('/v1/watches').send(goodWatch({ email }));
      expect(res.status, String(email)).toBe(400);
      expect(res.body.error.field).toBe('email');
      expect(res.body.error.message).toBe('That email address does not look complete.');
    }
    expect(h.repo.size()).toBe(0);
    expect(h.sender.sent).toEqual([]);
  });

  it('checks every other field before saving and names the one at fault', async () => {
    const h = makeWatchApp();
    for (const [over, field] of [
      [{ rule: 'nonsense' }, 'rule'],
      [{ date: '2150-01-01' }, 'date'],
      [{ date: undefined }, 'date'],
      [{ hour: 24 }, 'hour'],
      [{ margin: 9 }, 'margin'],
      [{ accuracy: 123 }, 'accuracy'],
      [{ site: 'im2', aim_east: 41, aim_north: 0 }, 'aim_east'],
      [{ site: 'im2', aim_east: 40 }, 'aim_north'],
    ] as const) {
      const res = await request(h.app).post('/v1/watches').send(goodWatch(over));
      expect(res.status, field).toBe(400);
      expect(res.body.error.field).toBe(field);
    }
    expect((await request(h.app).post('/v1/watches').send(goodWatch({ site: 'nowhere' }))).status).toBe(404);
    expect(h.repo.size()).toBe(0);
    expect(h.sender.sent).toEqual([]);
  });

  it('refuses custom coordinates with a clear message', async () => {
    const h = makeWatchApp();
    for (const body of [
      goodWatch({ site: undefined, lat: -85, lon: 30 }),
      goodWatch({ site: 'point:-85,30' }),
      goodWatch({ lat: -85, lon: 30 }),
    ]) {
      const res = await request(h.app).post('/v1/watches').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe('site');
      expect(res.body.error.message).toMatch(/custom coordinates/i);
    }
    expect(h.repo.size()).toBe(0);
  });

  it('refuses the odds rule for a site without terrain and says which sites have it (409)', async () => {
    const h = makeWatchApp();
    const res = await request(h.app).post('/v1/watches').send(goodWatch({ rule: 'odds70' }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('IM-2 target, Mons Mouton (im2)');
    expect(h.repo.size()).toBe(0);
    // The same site with terrain is accepted, aim and all.
    const ok = await request(h.app)
      .post('/v1/watches')
      .send(goodWatch({ site: 'im2', rule: 'odds70', aim_east: 120, aim_north: -80 }));
    expect(ok.status).toBe(201);
    const [shown] = await lookup(h, ok.body.manage_token);
    expect(shown!.scenario).toEqual({ date: '2025-03-06', hour: 12, margin: 2, accuracy: 250, aim_east: 120, aim_north: -80 });
  });

  it('keeps the watch waiting and answers 502 when the confirmation email cannot be sent', async () => {
    const h = makeWatchApp();
    h.sender.failures = 1;
    const res = await request(h.app).post('/v1/watches').send(goodWatch());
    expect(res.status).toBe(502);
    expect(res.body.error.message).toMatch(/could not send/i);
    expect(JSON.stringify(res.body)).not.toContain(ADDRESS);
    const [shown] = await lookup(h, res.body.watch.manage_token);
    expect(shown!.status).toBe('pending');
    expect(shown!.events.at(-1)!.message).toMatch(/could not be sent/i);
    // Send a new link then works.
    const again = await request(h.app)
      .post(`/v1/watches/${res.body.watch.id}/resend`)
      .send({ manage_token: res.body.watch.manage_token });
    expect(again.status).toBe(200);
    expect(h.sender.sent.length).toBe(1);
  });
});

describe('confirmation', () => {
  it('5-2: a waiting watch with a broken rule sends nothing on re-check', async () => {
    const h = makeWatchApp();
    const made = await createWatch(h, BROKEN);
    const res = await recheck(h, [made.manage_token], BROKEN);
    expect(res.status).toBe(200);
    expect(res.body.watches[0].status).toBe('pending');
    expect(h.sender.sent.length).toBe(1); // only the confirmation request
    expect(res.body.watches[0].events.some((e: { level: string }) => e.level === 'ALERT')).toBe(false);
  });

  it('5-3: confirm works once; a used or altered token is refused', async () => {
    const h = makeWatchApp();
    const made = await createWatch(h);
    const token = confirmTokenIn(h.sender.sent[0]!);

    const altered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    for (const bad of [altered, '', 'x', made.manage_token, undefined]) {
      const res = await request(h.app).post('/v1/watches/confirm').send({ token: bad });
      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe('token');
    }
    expect((await lookup(h, made.manage_token))[0]!.status).toBe('pending');

    h.clock.t += HOUR;
    const ok = await request(h.app).post('/v1/watches/confirm').send({ token });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: made.id, status: 'active', site: 'im1', rule: 'power' });
    expect(ok.body.manage_token).toBeUndefined();
    expect(ok.body.last_checked_at).toBe(new Date(h.clock.t).toISOString());
    expect(ok.body.events.map((e: { message: string }) => e.message)).toContain('Watch confirmed.');

    const again = await request(h.app).post('/v1/watches/confirm').send({ token });
    expect(again.status).toBe(400);
    expect(h.sender.sent.length).toBe(1);
  });

  it('5-3: a link older than 24 hours is refused, the watch shows expired, and a new link works', async () => {
    const h = makeWatchApp();
    const made = await createWatch(h);
    const oldToken = confirmTokenIn(h.sender.sent[0]!);
    h.clock.t += DAY + 1000;

    const late = await request(h.app).post('/v1/watches/confirm').send({ token: oldToken });
    expect(late.status).toBe(410);
    expect(late.body.error.message).toBe('That confirmation link has expired. Ask for a new one from the Watch tab.');
    expect((await lookup(h, made.manage_token))[0]!.status).toBe('expired');

    expect((await request(h.app).post(`/v1/watches/${made.id}/resend`).send({})).status).toBe(403);
    expect((await request(h.app).post(`/v1/watches/${made.id}/resend`).send({ manage_token: 'wrong' })).status).toBe(403);
    const resend = await request(h.app).post(`/v1/watches/${made.id}/resend`).send({ manage_token: made.manage_token });
    expect(resend.status).toBe(200);
    expect(resend.body.status).toBe('pending');
    expect(h.sender.sent.length).toBe(2);
    const newToken = confirmTokenIn(h.sender.sent[1]!);
    expect(newToken).not.toBe(oldToken);

    // The old link stays dead; the new one works.
    expect((await request(h.app).post('/v1/watches/confirm').send({ token: oldToken })).status).toBe(400);
    const ok = await request(h.app).post('/v1/watches/confirm').send({ token: newToken });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('active');

    // A confirmed watch has nothing to re-send.
    expect(
      (await request(h.app).post(`/v1/watches/${made.id}/resend`).send({ manage_token: made.manage_token })).status,
    ).toBe(409);
  });

  it('runs the first check at once: a rule already broken trips and sends one alert', async () => {
    const h = makeWatchApp();
    const made = await createWatch(h, BROKEN);
    const res = await request(h.app)
      .post('/v1/watches/confirm')
      .send({ token: confirmTokenIn(h.sender.sent[0]!) });
    expect(res.body.status).toBe('tripped');
    expect(h.sender.sent.length).toBe(2);
    expect(h.sender.sent[1]!.subject).toContain('No power at landing');
    expect((await lookup(h, made.manage_token))[0]!.status).toBe('tripped');
  });
});

describe('re-check on scenario change', () => {
  it('5-4, 5-5: a 10-day slip trips a "no power" watch once, and the email says what the log says', async () => {
    const h = makeWatchApp();
    const made = await createConfirmed(h);
    expect(h.sender.sent.length).toBe(1);
    expect((await lookup(h, made.manage_token))[0]!.status).toBe('active');

    h.clock.t += HOUR;
    const first = await recheck(h, [made.manage_token], BROKEN);
    expect(first.status).toBe(200);
    const tripped = first.body.watches[0];
    expect(tripped.status).toBe('tripped');
    expect(tripped.scenario).toMatchObject({ date: '2025-03-16' });
    expect(tripped.last_checked_at).toBe(new Date(h.clock.t).toISOString());

    const alerts = tripped.events.filter((e: { level: string }) => e.level === 'ALERT');
    expect(alerts.length).toBe(1);
    const reason: string = alerts[0].message;
    expect(reason).toContain('2025-03-16 12:00 UTC');
    expect(reason).toContain('-3.0 degrees');
    expect(reason).toContain('smooth Moon');

    expect(h.sender.sent.length).toBe(2);
    const mail = h.sender.sent[1]!;
    expect(mail.to).toBe(ADDRESS);
    expect(mail.text).toContain(reason);
    expect(mail.html).toContain(reason);
    expect(mail.text).toContain(`${SITE_URL}/watch`);
    expect(mail.text).toContain('We keep your address only to send this alert. Unsubscribe and it is deleted.');

    // Still broken: one alert per break, not one per check.
    h.clock.t += HOUR;
    const second = await recheck(h, [made.manage_token], { ...BROKEN, date: '2025-03-17' });
    expect(second.body.watches[0].status).toBe('tripped');
    expect(second.body.watches[0].events.filter((e: { level: string }) => e.level === 'ALERT').length).toBe(1);
    expect(h.sender.sent.length).toBe(2);

    // Slipping back: the log says it holds again and no email goes out.
    const back = await recheck(h, [made.manage_token], HOLDING);
    expect(back.body.watches[0].status).toBe('active');
    expect(back.body.watches[0].events.at(-1)).toMatchObject({ level: 'CLEAR', message: 'Rule holds again.' });
    expect(h.sender.sent.length).toBe(2);

    // A second break is a new break: one more alert.
    await recheck(h, [made.manage_token], BROKEN);
    expect(h.sender.sent.length).toBe(3);
  });

  it('checks the scenario and skips tokens it does not know', async () => {
    const h = makeWatchApp();
    const made = await createConfirmed(h);
    const bad = await recheck(h, [made.manage_token], { ...BROKEN, date: 'tomorrow' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.field).toBe('scenario.date');
    const none = await recheck(h, ['not-a-token'], BROKEN);
    expect(none.body).toEqual({ watches: [] });
    const many = await request(h.app)
      .post('/v1/watches/lookup')
      .send({ manage_tokens: Array.from({ length: 21 }, () => 'x') });
    expect(many.status).toBe(400);
    expect(many.body.error.field).toBe('manage_tokens');
    expect(h.sender.sent.length).toBe(1);
  });

  it('caps alert emails at 5 per watch per 24 hours and logs the rest', async () => {
    const h = makeWatchApp();
    const made = await createConfirmed(h);
    for (let i = 0; i < 6; i++) {
      await recheck(h, [made.manage_token], BROKEN);
      await recheck(h, [made.manage_token], HOLDING);
      h.clock.t += 60_000;
    }
    expect(h.sender.sent.length).toBe(1 + 5);
    const [shown] = await lookup(h, made.manage_token);
    expect(shown!.events.filter((e) => e.level === 'ALERT').length).toBe(6);
    expect(shown!.events.some((e) => /5 alert emails in 24 hours/.test(e.message))).toBe(true);

    // A day later the count starts again.
    h.clock.t += DAY;
    await recheck(h, [made.manage_token], BROKEN);
    expect(h.sender.sent.length).toBe(1 + 6);
  });
});

describe('delete and unsubscribe', () => {
  it('5-6, P-2: delete without the private token is refused; with it the row and its events are gone', async () => {
    const h = makeWatchApp();
    const made = await createConfirmed(h);
    const other = await createWatch(h, { site: 'im2' });

    expect((await request(h.app).delete(`/v1/watches/${made.id}`)).status).toBe(403);
    expect((await request(h.app).delete(`/v1/watches/${made.id}`).send({ manage_token: 'wrong' })).status).toBe(403);
    // Another watch's token does not open this one.
    expect(
      (await request(h.app).delete(`/v1/watches/${made.id}`).send({ manage_token: other.manage_token })).status,
    ).toBe(403);
    expect((await request(h.app).delete('/v1/watches/999').send({ manage_token: made.manage_token })).status).toBe(403);
    expect(await h.repo.get(made.id)).toBeDefined();

    const ok = await request(h.app).delete(`/v1/watches/${made.id}`).send({ manage_token: made.manage_token });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ deleted: true, id: made.id });
    expect(await h.repo.get(made.id)).toBeUndefined();
    expect(await h.repo.events(made.id)).toEqual([]);
    expect(await lookup(h, made.manage_token)).toEqual([]);
    expect(h.repo.size()).toBe(1);

    // The token may also travel in a header.
    const byHeader = await request(h.app).delete(`/v1/watches/${other.id}`).set('X-Manage-Token', other.manage_token);
    expect(byHeader.status).toBe(200);
    expect(h.repo.size()).toBe(0);
    expect(JSON.stringify(h.repo.dump())).not.toContain(ADDRESS);
  });

  it('every email carries one-click unsubscribe headers and the link; opening the link deletes nothing, the Stop alerts button does', async () => {
    const h = makeWatchApp();
    const made = await createConfirmed(h);
    await recheck(h, [made.manage_token], BROKEN);
    expect(h.sender.sent.length).toBe(2);
    for (const mail of h.sender.sent) {
      const url = unsubscribeUrlIn(mail);
      expect(mail.headers?.['List-Unsubscribe']).toBe(`<${url.toString()}>`);
      expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      expect(url.origin + url.pathname).toBe(`${SITE_URL}/v1/watches/unsubscribe`);
      expect(mail.text).toContain(url.toString());
      expect(mail.html).toContain(url.toString().replace(/&/g, '&amp;'));
      expect(url.toString()).not.toContain('example.org');
    }

    const url = unsubscribeUrlIn(h.sender.sent[1]!);
    // Opening the link (as a person, or a mail scanner that follows links) only shows a page.
    for (let i = 0; i < 3; i++) {
      const page = await request(h.app).get(url.pathname + url.search);
      expect(page.status).toBe(200);
      expect(page.headers['content-type']).toMatch(/text\/html/);
      expect(page.text).toContain('<html lang="en">');
      expect(page.text).toMatch(/<form method="post" action="\/v1\/watches\/unsubscribe\?token=[^"]+">/);
      expect(page.text).toContain('>Stop alerts</button>');
      expect(page.text).not.toMatch(/<(img|script|link)\b/i);
      expect(page.headers['content-security-policy']).toContain("form-action 'self'");
    }
    expect(await h.repo.get(made.id)).toBeDefined();

    // Pressing the button posts the form, which deletes the watch and its address.
    const action = /action="([^"]+)"/.exec((await request(h.app).get(url.pathname + url.search)).text)![1]!.replace(/&amp;/g, '&');
    const res = await request(h.app).post(action).type('form').send('stop=1');
    expect(res.status).toBe(200);
    expect(res.text).toContain('You are unsubscribed. Your address has been deleted.');
    expect(h.repo.size()).toBe(0);
    expect(JSON.stringify(h.repo.dump())).not.toContain(ADDRESS);

    // Opening or posting again, or with a made-up token, gets the same friendly page and no button.
    for (const path of [url.pathname + url.search, '/v1/watches/unsubscribe?token=%3Cb%3Enope', '/v1/watches/unsubscribe']) {
      for (const method of ['get', 'post'] as const) {
        const again = await request(h.app)[method](path);
        expect(again.status).toBe(200);
        expect(again.text).toContain('There is nothing to remove.');
        expect(again.text).not.toContain('<b>');
        expect(again.text).not.toContain('<form');
      }
    }
  });

  it('POST one-click unsubscribe deletes too, and the manage token works as well', async () => {
    const h = makeWatchApp();
    const a = await createWatch(h);
    const b = await createWatch(h, { site: 'im2' });
    const url = unsubscribeUrlIn(h.sender.sent[0]!);
    const res = await request(h.app)
      .post(url.pathname + url.search)
      .type('form')
      .send('List-Unsubscribe=One-Click');
    expect(res.status).toBe(200);
    expect(await h.repo.get(a.id)).toBeUndefined();
    expect(await h.repo.get(b.id)).toBeDefined();

    const byManage = await request(h.app).post(`/v1/watches/unsubscribe?token=${b.manage_token}`);
    expect(byManage.status).toBe(200);
    expect(h.repo.size()).toBe(0);
  });

  it('an unsubscribe link altered to point at another watch removes nothing', async () => {
    const h = makeWatchApp();
    const a = await createWatch(h);
    await createWatch(h, { site: 'im2' });
    const token = unsubscribeUrlIn(h.sender.sent[1]!).searchParams.get('token')!;
    const forged = token.replace(/^\d+\./, `${a.id}.`);
    await request(h.app).get(`/v1/watches/unsubscribe?token=${forged}`);
    await request(h.app).post(`/v1/watches/unsubscribe?token=${forged}`);
    expect(h.repo.size()).toBe(2);
  });
});

describe('request bodies', () => {
  it('a body that is not valid JSON gets a plain 400, not an internal error', async () => {
    const h = makeWatchApp();
    const res = await request(h.app)
      .post('/v1/watches')
      .set('Content-Type', 'application/json')
      .send('{"site": "im1", "email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'The request body is not valid JSON.' } });
    expect(h.repo.size()).toBe(0);
  });
});

describe('limits', () => {
  it('allows only so many new watches per visitor per hour (429 with the seconds to wait)', async () => {
    const h = makeWatchApp({ watch: { perHour: 2 } });
    await createWatch(h, { email: 'a@example.org' });
    await createWatch(h, { email: 'b@example.org' });
    // A refused request does not use up the allowance.
    expect((await request(h.app).post('/v1/watches').send(goodWatch({ email: 'nope' }))).status).toBe(400);
    const third = await request(h.app).post('/v1/watches').send(goodWatch({ email: 'c@example.org' }));
    expect(third.status).toBe(429);
    expect(third.body.error.retryAfterSeconds).toBe(3600);
    expect(third.headers['retry-after']).toBe('3600');
    expect(h.repo.size()).toBe(2);
    expect(h.sender.sent.length).toBe(2);

    h.clock.t += HOUR;
    await createWatch(h, { email: 'c@example.org' });
  });

  it('allows at most 3 watches per address', async () => {
    const h = makeWatchApp();
    for (const site of ['im1', 'im2', 'shk']) await createWatch(h, { site });
    h.clock.t += 2 * DAY; // the daily email allowance is not what stops the fourth
    const fourth = await request(h.app)
      .post('/v1/watches')
      .send(goodWatch({ site: 'ch3', email: ADDRESS.toUpperCase() }));
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.message).toMatch(/3 watches/);
    expect(fourth.body.error.message).not.toMatch(/example\.org/i);
    expect(h.repo.size()).toBe(3);
    expect(h.sender.sent.length).toBe(3);
  });

  it('sends at most 3 confirmation emails to one address in 24 hours', async () => {
    const h = makeWatchApp();
    const made = await createWatch(h);
    const resend = () =>
      request(h.app).post(`/v1/watches/${made.id}/resend`).send({ manage_token: made.manage_token });
    expect((await resend()).status).toBe(200);
    expect((await resend()).status).toBe(200);
    const fourth = await resend();
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.retryAfterSeconds).toBeGreaterThan(0);
    // A new watch for the same address is stopped too, before anything is saved.
    expect((await request(h.app).post('/v1/watches').send(goodWatch({ site: 'im2' }))).status).toBe(429);
    expect(h.sender.sent.length).toBe(3);
    expect(h.repo.size()).toBe(1);

    h.clock.t += DAY + 1000;
    expect((await resend()).status).toBe(200);
    expect(h.sender.sent.length).toBe(4);
  });
});
