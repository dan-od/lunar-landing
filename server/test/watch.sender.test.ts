// The email sender, against a stand-in for fetch. The real network is never used.
import { describe, it, expect } from 'vitest';
import { FakeSender, devLogSender, resendSender, type EmailMessage } from '../src/watch/sender.js';
import { maskEmail } from '../src/watch/mask.js';
import { hashToken, newToken, sameHash } from '../src/watch/tokens.js';
import { watchMode } from '../src/config.js';

const KEY = 're_test_not_a_real_key';
const FROM = 'Moon Status <moon@okoro.me>';
const message: EmailMessage = {
  to: 'dana.tester@example.org',
  subject: 'Moon Status alert',
  text: 'plain',
  html: '<p>plain</p>',
  headers: {
    'List-Unsubscribe': '<https://moon.example.test/v1/watches/unsubscribe?token=abc>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
};

describe('resendSender', () => {
  it('builds one POST to the email service with the key, the from address and the headers', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify({ id: 'e1' }), { status: 200 });
    }) as typeof fetch;

    await resendSender(KEY, FROM, fakeFetch).send(message);
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(calls[0]!.init.method).toBe('POST');
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(headers.get('content-type')).toBe('application/json');
    expect(calls[0]!.init.redirect).toBe('error');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      from: FROM,
      to: ['dana.tester@example.org'],
      subject: 'Moon Status alert',
      text: 'plain',
      html: '<p>plain</p>',
      headers: message.headers,
    });
  });

  it('throws on a refusal or a network failure without repeating the address or the key', async () => {
    const refusing = (async () =>
      new Response(`{"message":"cannot send to dana.tester@example.org with ${KEY}"}`, { status: 422 })) as typeof fetch;
    const broken = (async () => {
      throw new Error(`connect failed for dana.tester@example.org using ${KEY}`);
    }) as typeof fetch;
    for (const f of [refusing, broken]) {
      const err = await resendSender(KEY, FROM, f)
        .send(message)
        .then(
          () => undefined,
          (e: Error) => e,
        );
      expect(err).toBeInstanceOf(Error);
      const seen = `${err!.message} ${err!.stack} ${JSON.stringify(err)} ${String((err as Error & { cause?: unknown }).cause)}`;
      expect(seen).not.toContain('dana.tester');
      expect(seen).not.toContain(KEY);
    }
    const err = (await resendSender(KEY, FROM, refusing)
      .send(message)
      .catch((e: Error) => e)) as Error;
    expect(err.message).toContain('422');
  });
});

describe('FakeSender and the developer sender', () => {
  it('FakeSender records messages and can be told to fail', async () => {
    const s = new FakeSender();
    await s.send(message);
    s.failures = 1;
    await expect(s.send(message)).rejects.toThrow();
    await s.send(message);
    expect(s.sent.length).toBe(2);
    expect(s.attempts).toBe(3);
  });

  it('the developer sender sends nothing and logs the subject, the masked address and the links', async () => {
    const lines: string[] = [];
    await devLogSender((line) => lines.push(line)).send({
      ...message,
      text: 'Confirm: https://moon.example.test/watch?confirm=tok123\nStop: https://moon.example.test/v1/watches/unsubscribe?token=abc',
    });
    const out = lines.join('\n');
    expect(out).toContain('Moon Status alert');
    expect(out).toContain('d•••@example.org');
    expect(out).toContain('https://moon.example.test/watch?confirm=tok123');
    expect(out).not.toContain('dana.tester');
  });
});

describe('maskEmail (S-2)', () => {
  it('keeps the first letter and the domain only', () => {
    expect(maskEmail('dana.tester@example.org')).toBe('d•••@example.org');
    expect(maskEmail('x@example.org')).toBe('x•••@example.org');
    expect(maskEmail('not an address')).toBe('•••');
    expect(maskEmail('')).toBe('•••');
  });
});

describe('tokens', () => {
  it('are long, random, url-safe, and stored only as a keyed hash', () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes
    const h = hashToken(a, 'secret-one');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(a);
    expect(hashToken(a, 'secret-two')).not.toBe(h);
    expect(sameHash(h, hashToken(a, 'secret-one'))).toBe(true);
    expect(sameHash(h, hashToken(b, 'secret-one'))).toBe(false);
    expect(sameHash(h, 'short')).toBe(false);
  });
});

describe('watchMode: when email alerts are switched on', () => {
  const base = { emailSendingKey: '', tokenSigningSecret: '', emailSender: '', nodeEnv: 'development' };
  it('is off by default and unless both secrets and a database are present', () => {
    expect(watchMode(base, true)).toBe('off');
    expect(watchMode({ ...base, emailSendingKey: 'k' }, true)).toBe('off');
    expect(watchMode({ ...base, tokenSigningSecret: 's' }, true)).toBe('off');
    expect(watchMode({ ...base, emailSendingKey: 'k', tokenSigningSecret: 's' }, false)).toBe('off');
    expect(watchMode({ ...base, emailSendingKey: 'k', tokenSigningSecret: 's' }, true)).toBe('resend');
  });
  it('the fake sender is for development only and still needs the signing secret', () => {
    expect(watchMode({ ...base, emailSender: 'fake' }, true)).toBe('off');
    expect(watchMode({ ...base, emailSender: 'fake', tokenSigningSecret: 's' }, true)).toBe('fake');
    expect(watchMode({ ...base, emailSender: 'fake', tokenSigningSecret: 's' }, false)).toBe('off');
    expect(watchMode({ ...base, emailSender: 'fake', tokenSigningSecret: 's', nodeEnv: 'production' }, true)).toBe('off');
    expect(
      watchMode({ ...base, emailSender: 'fake', tokenSigningSecret: 's', emailSendingKey: 'k', nodeEnv: 'production' }, true),
    ).toBe('resend');
  });
});
