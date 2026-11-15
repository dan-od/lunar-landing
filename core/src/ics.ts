// A small calendar-file (iCalendar, RFC 5545) writer for the Watch tab's "Add to
// calendar" buttons. Text is escaped, lines are folded at 75 bytes and end in
// CRLF, and each event carries a display reminder.

export interface IcsEvent {
  uid: string;
  /** ISO-8601 UTC start. */
  start: string;
  minutes: number;
  summary: string;
  description: string;
  /** Minutes before the start to remind. */
  alarmMinutesBefore: number;
}

const stamp = (iso: string) => new Date(Date.parse(iso)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Escape text values: backslash, semicolon, comma and line breaks. */
export function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold a content line so no line is longer than 75 bytes. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (enc.encode(current + ch).length > limit) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(opts: { name: string; events: IcsEvent[]; stamp?: string }): string {
  const now = stamp(opts.stamp ?? new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Moon Status//Watch//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(opts.name)}`,
  ];
  for (const e of opts.events) {
    const startMs = Date.parse(e.start);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(new Date(startMs + e.minutes * 60_000).toISOString())}`,
      `SUMMARY:${icsText(e.summary)}`,
      `DESCRIPTION:${icsText(e.description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(e.summary)}`,
      `TRIGGER:-PT${Math.max(0, Math.round(e.alarmMinutesBefore))}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
