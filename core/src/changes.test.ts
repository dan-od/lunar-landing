import { describe, it, expect } from 'vitest';
import { computeResult } from './calculator.js';
import { changesFrom } from './changes.js';
import { buildIcs } from './ics.js';
import type { PositionRow } from './types.js';

const T0 = Date.parse('2025-03-06T00:00:00Z');
const iso = (h: number) => new Date(T0 + h * 3_600_000).toISOString().replace('.000Z', 'Z');
const rows = (body: 'sun' | 'earth', up: (h: number) => boolean, n = 48): PositionRow[] =>
  Array.from({ length: n }, (_, h) => ({ body, time: iso(h), azimuthDeg: 90, elevationDeg: up(h) ? 10 : -5 }));

describe('upcoming changes (Watch, 6-2)', () => {
  it('lists sunrise, sunset, Earth rise and Earth set in time order, from the calculator windows', () => {
    // Sun up 0-9, down 10-29, up 30-47. Earth down 0-4, up 5-47.
    const sun = rows('sun', (h) => h < 10 || h >= 30);
    const earth = rows('earth', (h) => h >= 5);
    const result = computeResult(sun, earth, { marginDeg: 2 });
    const changes = changesFrom(result, iso(0), 48);
    expect(changes.map((c) => [c.kind, c.time, c.hoursAfterLanding])).toEqual([
      ['earthrise', iso(5), 5],
      ['sunset', iso(10), 10],
      ['sunrise', iso(30), 30],
    ]);
    expect(changes.map((c) => c.label)).toEqual(['Earth rise', 'Sunset', 'Sunrise']);
  });

  it('never reports the landing moment or the end of the span as a change', () => {
    const always = computeResult(rows('sun', () => true), rows('earth', () => true), { marginDeg: 2 });
    expect(changesFrom(always, iso(0), 48)).toEqual([]);
  });
});

describe('calendar file', () => {
  const ics = buildIcs({
    name: 'Moon Status: IM-2',
    events: [
      {
        uid: 'sunset-20250306T1000Z-im2@moon-status',
        start: iso(10),
        minutes: 60,
        summary: 'Sunset at IM-2; target, Mons Mouton, \\ test',
        description: 'Smooth-Moon model.\nTimes to the hour.',
        alarmMinutesBefore: 60,
      },
    ],
    stamp: '2026-11-15T12:00:00Z',
  });

  it('is a valid calendar with a reminder and CRLF line ends', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('DTSTART:20250306T100000Z\r\n');
    expect(ics).toContain('DTEND:20250306T110000Z\r\n');
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\n');
    expect(ics).toContain('TRIGGER:-PT60M\r\n');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[^\r]\n/);
  });

  it('escapes commas, semicolons, backslashes and line breaks in text', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('SUMMARY:Sunset at IM-2\\; target\\, Mons Mouton\\, \\\\ test');
    expect(unfolded).toContain('DESCRIPTION:Smooth-Moon model.\\nTimes to the hour.');
  });
});
