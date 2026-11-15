// The two emails a watch sends: "please confirm" and "your rule broke". Short,
// plain, UTC times, the model named, and a one-click way out in every one.
import { aimText } from '@moon/core';
import type { EmailMessage } from './sender.js';
import { modelFor, ruleLabel, type RuleId, type WatchScenario } from './rules.js';

export const KEEP_LINE = 'We keep your address only to send this alert. Unsubscribe and it is deleted.';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Epoch ms as "YYYY-MM-DD HH:MM UTC". */
export const utc = (ms: number): string => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const isControl = (ch: string): boolean => {
  const code = ch.charCodeAt(0);
  return code < 32 || code === 127;
};

/** True when the text holds a line break, tab or any other control character. */
export const hasControlChars = (s: string): boolean => [...s].some(isControl);

/** A header value must stay on one line. */
const oneLine = (s: string): string =>
  [...s]
    .map((ch) => (isControl(ch) ? ' ' : ch))
    .join('')
    .trim();

export interface EmailContext {
  to: string;
  siteName: string;
  rule: RuleId;
  scenario: WatchScenario;
  /** Address of the site, no trailing slash. */
  publicSiteUrl: string;
  /** The full one-click unsubscribe link. */
  unsubscribeUrl: string;
}

/** The watched case, as label and value pairs. */
function facts(c: EmailContext): Array<[string, string]> {
  const s = c.scenario;
  const model = modelFor(c.rule, s);
  const out: Array<[string, string]> = [
    ['Site', c.siteName],
    ['Rule', ruleLabel(c.rule)],
    ['Landing', `${s.date} ${String(s.hour).padStart(2, '0')}:00 UTC`],
  ];
  if (model === 'terrain') out.push(['Aim', aimText(s.aim ?? { east: 0, north: 0 })]);
  else out.push(['Shadow allowance', `${s.margin} degrees`]);
  if (c.rule === 'odds70') out.push(['Lander accuracy', `${s.accuracy} m`]);
  out.push(['Model', model]);
  return out;
}

interface Part {
  /** A paragraph of plain words. */
  text?: string;
  /** A labelled link on its own line. */
  link?: { label: string; url: string };
  /** Label and value lines. */
  facts?: Array<[string, string]>;
}

function build(c: EmailContext, subject: string, parts: Part[]): EmailMessage {
  const all: Part[] = [
    ...parts,
    { link: { label: 'Stop this alert and delete your address', url: c.unsubscribeUrl } },
    { text: KEEP_LINE },
  ];
  const text = all
    .map((p) => {
      if (p.text !== undefined) return p.text;
      if (p.link) return `${p.link.label}:\n${p.link.url}`;
      return (p.facts ?? []).map(([k, v]) => `${k}: ${v}`).join('\n');
    })
    .join('\n\n');
  const html = [
    '<!doctype html><html lang="en"><body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111;">',
    ...all.map((p) => {
      if (p.text !== undefined) return `<p>${escapeHtml(p.text)}</p>`;
      if (p.link) {
        return `<p>${escapeHtml(p.link.label)}:<br><a href="${escapeHtml(p.link.url)}">${escapeHtml(p.link.url)}</a></p>`;
      }
      return `<p>${(p.facts ?? []).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join('<br>')}</p>`;
    }),
    '</body></html>',
  ].join('\n');
  return {
    to: c.to,
    subject: oneLine(subject),
    text: `${text}\n`,
    html,
    headers: {
      'List-Unsubscribe': `<${c.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

/** "Please confirm": sent when a watch is made, and again on "Send a new link". */
export function confirmationEmail(c: EmailContext, confirmToken: string, expiresAt: number): EmailMessage {
  return build(c, 'Confirm your Moon Status alert', [
    { text: 'Someone asked Moon Status to email this address when a rule breaks for a Moon landing site.' },
    { facts: facts(c) },
    {
      link: {
        label: `Confirm this alert (the link works until ${utc(expiresAt)})`,
        url: `${c.publicSiteUrl}/watch?confirm=${confirmToken}`,
      },
    },
    { text: 'If this was not you, do nothing. No alert is sent unless the link is used.' },
  ]);
}

/** "Your rule broke": one per break. `reason` is the sentence written to the event log. */
export function alertEmail(c: EmailContext, reason: string, checkedAt: number): EmailMessage {
  return build(c, `Moon Status alert: ${ruleLabel(c.rule)}, ${c.siteName}`, [
    { text: reason },
    { facts: [...facts(c), ['Checked', utc(checkedAt)]] },
    { link: { label: 'See this watch', url: `${c.publicSiteUrl}/watch` } },
    { text: 'You get one email each time the rule breaks, not one for every check.' },
  ]);
}
