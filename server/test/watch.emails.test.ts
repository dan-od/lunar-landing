import { describe, expect, it } from 'vitest';
import {
  KEEP_LINE,
  MOON_MARK_PATH,
  NOT_YOU_LINE,
  POSITIONS_LINE,
  alertEmail,
  confirmationEmail,
  type EmailContext,
} from '../src/watch/emails.js';

const ctx: EmailContext = {
  to: 'someone@example.com',
  siteName: 'IM-2 target, Mons Mouton <b>',
  rule: 'power',
  scenario: { date: '2026-11-20', hour: 12, margin: 2, accuracy: 250 },
  publicSiteUrl: 'https://moon.okoro.me',
  unsubscribeUrl: 'https://moon.okoro.me/v1/watch/unsubscribe?t=abc&x=1',
};
const expires = Date.UTC(2026, 10, 16, 23, 0);
const confirm = confirmationEmail(ctx, 'tok123', expires);
const alert = alertEmail(ctx, 'IM-2 has no power at landing.', Date.UTC(2026, 10, 18, 6, 0));
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

describe('Watch emails, HTML', () => {
  for (const [name, mail] of [['confirmation', confirm], ['alert', alert]] as const) {
    it(`${name}: no scripts, no SVG, no remote CSS; inline styles and a 560 px table`, () => {
      expect(mail.html).not.toMatch(/<script|<svg|<link|<style|@import|javascript:|\son\w+=/i);
      expect(mail.html).toContain('max-width:560px');
      expect(mail.html).toContain('role="presentation"');
      expect(mail.html).not.toMatch(/border-radius/);
      // the only image is the hosted PNG moon mark
      const imgs = [...mail.html.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1]);
      expect(imgs).toEqual([`https://moon.okoro.me${MOON_MARK_PATH}`]);
      expect(mail.html).toContain('#07173F');
      expect(mail.html).toContain('MOON STATUS');
    });

    it(`${name}: footer lines, unsubscribe link and headers`, () => {
      for (const line of [NOT_YOU_LINE, POSITIONS_LINE, KEEP_LINE]) expect(mail.html).toContain(line.replace("'", '&#39;'));
      expect(hrefs(mail.html)).toContain(ctx.unsubscribeUrl);
      expect(mail.headers?.['List-Unsubscribe']).toBe(`<${ctx.unsubscribeUrl}>`);
      expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      // every link in the plain text is also in the HTML
      for (const url of mail.text.match(/https?:\/\/\S+/g) ?? []) expect(hrefs(mail.html)).toContain(url);
      // user text is escaped
      expect(mail.html).toContain('Mons Mouton &lt;b&gt;');
      expect(mail.html).not.toContain('Mons Mouton <b>');
    });
  }

  it('confirmation: status chip, details, a Neon Yellow button with dark text, expiry and fallback link', () => {
    const url = 'https://moon.okoro.me/watch?confirm=tok123';
    expect(confirm.html).toMatch(/○ NOT CONFIRMED YET/);
    for (const k of ['Site', 'Rule', 'Landing', 'Shadow allowance', 'Model']) expect(confirm.html).toContain(`>${k}</td>`);
    expect(confirm.html).toContain('2026-11-20 12:00 UTC');
    expect(confirm.html).toMatch(/bgcolor="#EAFE07"[^>]*><a href="[^"]+"[^>]*color:#07173F[^>]*>Confirm this alert<\/a>/);
    expect(hrefs(confirm.html).filter((h) => h === url)).toHaveLength(2); // button and fallback
    expect(confirm.html).toContain('The link works until 2026-11-16 23:00 UTC.');
    expect(confirm.html).toContain('If the button does not work, open this link:');
  });

  it('plain text is unchanged in shape and stays the alternative', () => {
    expect(confirm.text).toContain('Confirm this alert (the link works until 2026-11-16 23:00 UTC):\nhttps://moon.okoro.me/watch?confirm=tok123');
    expect(confirm.text).toContain('Stop this alert and delete your address:\n' + ctx.unsubscribeUrl);
    expect(confirm.text).not.toMatch(/<table|<a |<p /);
    expect(alert.text).toContain('See this watch:\nhttps://moon.okoro.me/watch');
  });

  it('alert: the chip says the rule broke with a symbol and a word', () => {
    expect(alert.html).toContain('▲ RULE BROKEN');
    expect(alert.html).toContain('IM-2 has no power at landing.');
    expect(alert.html).toContain('>Checked</td>');
  });
});
