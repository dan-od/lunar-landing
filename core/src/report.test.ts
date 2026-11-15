import { describe, it, expect } from 'vitest';
import { computeResult } from './calculator.js';
import { buildReport, reportText, MARK_SYMBOL } from './report.js';
import type { PositionRow, Body, WindowResult } from './types.js';

function series(body: Body, elevs: number[]): PositionRow[] {
  const t0 = Date.parse('2025-03-06T00:00:00Z');
  return elevs.map((elevationDeg, i) => ({
    body,
    time: new Date(t0 + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
    azimuthDeg: 0,
    elevationDeg,
  }));
}

/** A 10-day case: Sun up for `sunUp` hours then down; Earth down for `earthGap` hours in the middle. */
function caseOf(sunUp: number, earthGap: number, sunAtLanding = 5): WindowResult {
  const n = 240;
  const sun = Array.from({ length: n }, (_, i) => (i < sunUp ? 5 : -5));
  sun[0] = sunAtLanding;
  const earth = Array.from({ length: n }, (_, i) => (i >= 100 && i < 100 + earthGap ? -5 : 8));
  return computeResult(series('sun', sun), series('earth', earth), { marginDeg: 2 });
}

describe('buildReport: sentences are built from the calculator output on each side (3-3)', () => {
  const a = caseOf(120, 48);
  const b = caseOf(180, 24);
  const r = buildReport(a, b);

  it('gives a verdict and exactly five sentences', () => {
    expect(r.lines.length).toBe(5);
    expect(r.verdict).toBe('B is the better case');
    expect(r.same).toBe(false);
  });

  it('every number in the sentences is the number on that side', () => {
    expect(r.lines[0]!.text).toBe(
      `Time in sunlight goes from ${a.power.uptimePct}% to ${b.power.uptimePct}%.`,
    );
    expect(r.lines[1]!.text).toBe(
      `Earth contact goes from ${a.contact.uptimePct}% to ${b.contact.uptimePct}%.`,
    );
    expect(r.lines[2]!.text).toBe('Power at landing is the same on both sides (Sun up).');
    expect(r.lines[3]!.text).toBe(
      `Longest dark stretch: ${a.power.longestGapDays.toFixed(1)} days in A, ${b.power.longestGapDays.toFixed(1)} days in B.`,
    );
    expect(r.lines[4]!.text).toBe(
      `Longest gap in Earth contact: ${a.contact.longestGapDays.toFixed(1)} days in A, ${b.contact.longestGapDays.toFixed(1)} days in B.`,
    );
  });

  it('marks each sentence better, worse or same from B’s point of view', () => {
    expect(r.lines.map((l) => l.mark)).toEqual(['better', 'better', 'same', 'better', 'better']);
    const reversed = buildReport(b, a);
    expect(reversed.lines.map((l) => l.mark)).toEqual(['worse', 'worse', 'same', 'worse', 'worse']);
    expect(reversed.verdict).toBe('B is the worse case');
  });

  it('says so when power at landing differs', () => {
    const dark = caseOf(120, 48, -5);
    const line = buildReport(a, dark).lines[2]!;
    expect(line.text).toBe('Power at landing: Sun up in A, Sun down in B.');
    expect(line.mark).toBe('worse');
  });

  it('reports no clear winner when gains and losses balance', () => {
    const moreSunLessLink = caseOf(180, 96);
    const mixed = buildReport(a, moreSunLessLink);
    expect(mixed.lines.map((l) => l.mark)).toEqual(['better', 'worse', 'same', 'better', 'worse']);
    expect(mixed.verdict).toBe('No clear winner');
  });
});

describe('identical sides (3-4)', () => {
  const a = caseOf(120, 48);
  const r = buildReport(a, caseOf(120, 48));

  it('shows "No meaningful change" with every sentence marked same', () => {
    expect(r.verdict).toBe('No meaningful change');
    expect(r.same).toBe(true);
    expect(r.note).toBe('The Moon turns slowly, so a few hours often changes nothing.');
    expect(r.lines.every((l) => l.mark === 'same')).toBe(true);
    expect(r.lines[0]!.text).toBe(`Time in sunlight is unchanged at ${a.power.uptimePct}%.`);
    expect(r.lines[1]!.text).toBe(`Earth contact is unchanged at ${a.contact.uptimePct}%.`);
  });

  it('treats a difference too small to show as no change', () => {
    const base = caseOf(120, 48);
    const nearly: WindowResult = {
      ...base,
      power: { ...base.power, longestGapDays: base.power.longestGapDays + 0.01 },
    };
    expect(buildReport(base, nearly).same).toBe(true);
  });
});

describe('reportText (3-5): the copied text is the on-screen sentences', () => {
  it('is the verdict, then each sentence with its mark, then the context line', () => {
    const r = buildReport(caseOf(120, 48), caseOf(180, 24));
    const text = reportText(r, 'A: x. B: y. Smooth-Moon model.');
    const lines = text.split('\n');
    expect(lines[0]).toBe(r.verdict);
    expect(lines.slice(1, 6)).toEqual(r.lines.map((l) => `${MARK_SYMBOL[l.mark]} ${l.label}: ${l.text}`));
    expect(lines[6]).toBe('A: x. B: y. Smooth-Moon model.');
  });
});
