import { describe, it, expect } from 'vitest';
import { computeResult, stateFor } from '@moon/core';
import type { SeriesPoint } from './api';
import { fmtDeg, fmtDuration, indexAt, readoutAt, resultFor, skyFraction, skyScale, toSeries } from './siteData';

/** 31 days of hourly points from 00:00 on the landing date, with a slow swing. */
function points(date = '2025-03-06'): SeriesPoint[] {
  const t0 = Date.parse(`${date}T00:00:00Z`);
  return Array.from({ length: 31 * 24 }, (_, i) => ({
    t: new Date(t0 + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
    sun_elev: 4 * Math.sin(i / 110),
    sun_az: (i * 0.5) % 360,
    earth_elev: 6 + 5 * Math.sin(i / 90),
    earth_az: 335,
  }));
}

describe('toSeries', () => {
  it('starts at the landing hour and keeps 30 days plus the closing hour', () => {
    const s = toSeries(points(), '2025-03-06', 5);
    expect(s.sun[0]!.time).toBe('2025-03-06T05:00:00Z');
    expect(s.sun.length).toBe(721);
    expect(s.earth.length).toBe(721);
  });

  it('is empty when the landing moment is not in the data', () => {
    expect(toSeries(points(), '2025-04-20', 0).sun.length).toBe(0);
  });
});

describe('readouts follow the marker (1-4)', () => {
  it('readouts at day 12 equal the calculator at day 12', () => {
    const s = toSeries(points(), '2025-03-06', 0);
    const r = readoutAt(s, 2, 12)!;
    const row = indexAt(12);
    expect(row).toBe(288);
    expect(r.time).toBe('2025-03-18T00:00:00Z');
    expect(r.sunElev).toBe(s.sun[row]!.elevationDeg);
    expect(r.earthElev).toBe(s.earth[row]!.elevationDeg);
    expect(r.state).toEqual(stateFor(s.sun[row]!.elevationDeg, s.earth[row]!.elevationDeg, 2));
  });

  it('has no readout where nothing is saved', () => {
    const s = toSeries(points().slice(0, 100), '2025-03-06', 0);
    expect(readoutAt(s, 2, 12)).toBeUndefined();
  });
});

describe('timeline numbers come from the one calculator (1-3, 1-8)', () => {
  it('matches computeResult over the 30 days, and changes with the allowance', () => {
    const s = toSeries(points(), '2025-03-06', 0);
    const at2 = resultFor(s, 2);
    expect(at2).toEqual(computeResult(s.sun.slice(0, 720), s.earth.slice(0, 720), { marginDeg: 2 }));
    const at0 = resultFor(s, 0);
    expect(at0.power.uptimePct).toBeGreaterThan(at2.power.uptimePct);
  });
});

describe('sky view geometry (1-11)', () => {
  it('uses a tight scale near the pole and a full one elsewhere', () => {
    expect(skyScale(1.7, 10.9)).toEqual({ lo: -10, hi: 15 });
    expect(skyScale(50, 60)).toEqual({ lo: -10, hi: 90 });
  });

  it('places heights in proportion and clamps what is off the picture', () => {
    const scale = { lo: -10, hi: 15 };
    expect(skyFraction(15, scale)).toBe(0);
    expect(skyFraction(0, scale)).toBeCloseTo(0.6, 6); // the horizon line
    expect(skyFraction(2, scale)).toBeCloseTo(0.52, 6); // a 2 degree allowance
    expect(skyFraction(-40, scale)).toBe(1);
  });
});

describe('formatting', () => {
  it('formats heights and durations', () => {
    expect(fmtDeg(1.726)).toBe('+1.7°');
    expect(fmtDeg(-3.21)).toBe('−3.2°');
    expect(fmtDuration(7)).toBe('7 h');
    expect(fmtDuration(36)).toBe('1.5 d');
  });
});
