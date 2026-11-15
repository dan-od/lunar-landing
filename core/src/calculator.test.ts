import { describe, it, expect } from 'vitest';
import { stateFor, summarizeSeries, computeResult } from './calculator.js';
import type { PositionRow, Body } from './types.js';

/** Build an hourly series from elevations starting at a fixed UTC time. */
function series(body: Body, elevs: number[], startIso = '2025-03-06T00:00:00Z'): PositionRow[] {
  const t0 = Date.parse(startIso);
  return elevs.map((elevationDeg, i) => ({
    body,
    time: new Date(t0 + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
    azimuthDeg: 0,
    elevationDeg,
  }));
}

describe('stateFor', () => {
  it('maps the four locked states with a symbol and a word', () => {
    expect(stateFor(5, 5, 2)).toMatchObject({ word: 'READY', symbol: '●' });
    expect(stateFor(1, 5, 2)).toMatchObject({ word: 'NO POWER', symbol: '▲' });
    expect(stateFor(5, 1, 2)).toMatchObject({ word: 'NO LINK', symbol: '■' });
    expect(stateFor(1, 1, 2)).toMatchObject({ word: 'DARK, NO LINK', symbol: '✕' });
  });

  it('treats elevation exactly at the allowance as below it', () => {
    expect(stateFor(2, 5, 2).powerUp).toBe(false);
  });
});

describe('summarizeSeries', () => {
  it('computes uptime, longest gap and next change', () => {
    // 6 hourly samples: up, up, down, down, down, up
    const s = summarizeSeries(series('sun', [5, 5, -1, -1, -1, 5]), 2);
    expect(s.uptimePct).toBe(50); // 3 of 6 up
    expect(s.longestGapDays).toBeCloseTo(3 / 24, 6); // 3 down samples * 1h
    expect(s.nextChangeHours).toBe(2); // up at 0,1 then down at hour 2
    expect(s.windows.length).toBe(2);
    expect(s.windows[0]).toMatchObject({ start: '2025-03-06T00:00:00Z', hours: 2 });
  });

  it('reports no next change when the state never changes', () => {
    const s = summarizeSeries(series('earth', [10, 10, 10]), 2);
    expect(s.uptimePct).toBe(100);
    expect(s.nextChangeHours).toBeNull();
    expect(s.longestGapDays).toBe(0);
  });
});

describe('computeResult works-definition (F-7 shape)', () => {
  it('is true only when ready at touchdown and >=90% of the first 10 days', () => {
    const up10 = new Array(240).fill(5);
    const res = computeResult(series('sun', up10), series('earth', up10), { marginDeg: 2 });
    expect(res.landing.word).toBe('READY');
    expect(res.works).toBe(true);
    expect(res.model).toBe('smooth Moon');
  });

  it('is false when under 90% of the first 10 days is ready', () => {
    const sun = new Array(240).fill(5);
    // 25% of the window is dark -> below the 90% threshold
    for (let i = 0; i < 60; i++) sun[i + 1] = -1;
    const earth = new Array(240).fill(10);
    const res = computeResult(series('sun', sun), series('earth', earth), { marginDeg: 2 });
    expect(res.works).toBe(false);
  });

  it('is false when not ready at touchdown even if the rest is sunny', () => {
    const sun = new Array(240).fill(5);
    sun[0] = -1; // dark at the landing moment
    const earth = new Array(240).fill(10);
    const res = computeResult(series('sun', sun), series('earth', earth), { marginDeg: 2 });
    expect(res.landing.word).toBe('NO POWER');
    expect(res.works).toBe(false);
  });
});
