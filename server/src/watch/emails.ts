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
  /** The main action: a button in HTML, a labelled link in plain text. */
  button?: { label: string; url: string; plain: string; note?: string };
  /** Label and value lines. */
  facts?: Array<[string, string]>;
}

/** The status at the top of the HTML email: a symbol and a word, never colour alone. */
interface Chip {
  symbol: string;
  word: string;
  /** Border colour. */
  edge: string;
}

export const MOON_MARK_PATH = '/icon-192.png';
export const POSITIONS_LINE = 'Positions from NASA JPL Horizons.';
export const NOT_YOU_LINE = "If this wasn't you, do nothing.";

const DEEP = '#07173F';
const NEON = '#EAFE07';
const MUTED = '#4A5878';
const FONT = 'Arial,Helvetica,sans-serif';

/** Table layout with inline styles only: no scripts, no SVG, no remote CSS. */
function renderHtml(c: EmailContext, subject: string, chip: Chip, parts: Part[], unsubscribe: string): string {
  const e = escapeHtml;
  const p = (t: string, extra = '') =>
    `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${DEEP};${extra}">${e(t)}</p>`;
  const body = parts.map((part) => {
    if (part.text !== undefined) return p(part.text);
    if (part.facts) {
      const rows = part.facts
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #D5DBEA;font-family:${FONT};font-size:12px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};vertical-align:top;width:40%;">${e(k)}</td>` +
            `<td style="padding:8px 0;border-bottom:1px solid #D5DBEA;font-family:${FONT};font-size:15px;line-height:22px;color:${DEEP};vertical-align:top;">${e(v)}</td></tr>`,
        )
        .join('');
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px;border-top:1px solid #D5DBEA;">${rows}</table>`;
    }
    if (part.button) {
      const b = part.button;
      return [
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;"><tr><td bgcolor="${NEON}" style="background:${NEON};border:2px solid ${DEEP};">`,
        `<a href="${e(b.url)}" style="display:inline-block;padding:16px 32px;font-family:${FONT};font-size:18px;line-height:22px;font-weight:bold;color:${DEEP};text-decoration:none;">${e(b.label)}</a>`,
        '</td></tr></table>',
        b.note ? p(b.note, `font-size:14px;line-height:20px;color:${MUTED};margin-bottom:8px;`) : '',
        `<p style="margin:0 0 24px;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">If the button does not work, open this link:<br><a href="${e(b.url)}" style="color:#0042A6;word-break:break-all;">${e(b.url)}</a></p>`,
      ].join('');
    }
    if (part.link) {
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:22px;color:${DEEP};">${e(part.link.label)}:<br><a href="${e(part.link.url)}" style="color:#0042A6;word-break:break-all;">${e(part.link.url)}</a></p>`;
    }
    return '';
  });
  const small = (inner: string) =>
    `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${inner}</p>`;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">',
    `<title>${e(subject)}</title></head>`,
    '<body style="margin:0;padding:0;background:#E9EDF6;">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E9EDF6;"><tr><td align="center" style="padding:24px 12px;">`,
    '<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#FFFFFF;border-collapse:collapse;">`,
    // header
    `<tr><td bgcolor="${DEEP}" style="background:${DEEP};padding:16px 24px;">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td style="padding-right:10px;vertical-align:middle;"><img src="${e(c.publicSiteUrl + MOON_MARK_PATH)}" width="28" height="28" alt="" style="display:block;border:0;outline:none;"></td>`,
    `<td style="vertical-align:middle;font-family:${FONT};font-size:16px;line-height:20px;font-weight:bold;letter-spacing:3px;color:#FFFFFF;">MOON STATUS</td>`,
    '</tr></table></td></tr>',
    // body
    '<tr><td style="padding:28px 24px 12px;">',
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="border:2px solid ${chip.edge};padding:6px 12px;font-family:${FONT};font-size:13px;line-height:18px;font-weight:bold;letter-spacing:2px;color:${DEEP};">${e(chip.symbol)} ${e(chip.word)}</td></tr></table>`,
    ...body,
    '</td></tr>',
    // footer
    `<tr><td style="padding:16px 24px 20px;background:#F4F6FB;border-top:1px solid #D5DBEA;">`,
    small(e(NOT_YOU_LINE)),
    small(`<a href="${e(unsubscribe)}" style="color:${MUTED};text-decoration:underline;">Stop this alert and delete your address</a>`),
    small(e(KEEP_LINE)),
    small(e(POSITIONS_LINE)),
    '</td></tr>',
    '</table>',
    '<!--[if mso]></td></tr></table><![endif]-->',
    '</td></tr></table>',
    '</body>',
    '</html>',
  ].join('\n');
}

function build(c: EmailContext, subject: string, chip: Chip, parts: Part[]): EmailMessage {
  const all: Part[] = [
    ...parts,
    { link: { label: 'Stop this alert and delete your address', url: c.unsubscribeUrl } },
    { text: KEEP_LINE },
  ];
  const text = all
    .map((p) => {
      if (p.text !== undefined) return p.text;
      if (p.button) return `${p.button.plain}:\n${p.button.url}`;
      if (p.link) return `${p.link.label}:\n${p.link.url}`;
      return (p.facts ?? []).map(([k, v]) => `${k}: ${v}`).join('\n');
    })
    .join('\n\n');
  return {
    to: c.to,
    subject: oneLine(subject),
    text: `${text}\n`,
    html: renderHtml(c, subject, chip, parts, c.unsubscribeUrl),
    headers: {
      'List-Unsubscribe': `<${c.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

/** "Please confirm": sent when a watch is made, and again on "Send a new link". */
export function confirmationEmail(c: EmailContext, confirmToken: string, expiresAt: number): EmailMessage {
  return build(c, 'Confirm your Moon Status alert', { symbol: '○', word: 'NOT CONFIRMED YET', edge: DEEP }, [
    { text: 'Someone asked Moon Status to email this address when a rule breaks for a Moon landing site.' },
    { facts: facts(c) },
    {
      button: {
        label: 'Confirm this alert',
        plain: `Confirm this alert (the link works until ${utc(expiresAt)})`,
        note: `The link works until ${utc(expiresAt)}.`,
        url: `${c.publicSiteUrl}/watch?confirm=${confirmToken}`,
      },
    },
    { text: 'If this was not you, do nothing. No alert is sent unless the link is used.' },
  ]);
}

/** "Your rule broke": one per break. `reason` is the sentence written to the event log. */
export function alertEmail(c: EmailContext, reason: string, checkedAt: number): EmailMessage {
  return build(c, `Moon Status alert: ${ruleLabel(c.rule)}, ${c.siteName}`, { symbol: '▲', word: 'RULE BROKEN', edge: '#E43700' }, [
    { text: reason },
    { facts: [...facts(c), ['Checked', utc(checkedAt)]] },
    { button: { label: 'See this watch', plain: 'See this watch', url: `${c.publicSiteUrl}/watch` } },
    { text: 'You get one email each time the rule breaks, not one for every check.' },
  ]);
}
