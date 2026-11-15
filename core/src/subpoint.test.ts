import { describe, it, expect } from 'vitest';
import { subPoint } from './subpoint.js';

describe('subPoint', () => {
  it('is the site itself when the body is at the zenith', () => {
    const p = subPoint(10, 40, 0, 90);
    expect(p.lat).toBeCloseTo(10, 6);
  });

  it('puts a body rising due east on the equator 90 degrees to the east', () => {
    const p = subPoint(0, 20, 90, 0);
    expect(p.lat).toBeCloseTo(0, 6);
    expect(p.lon).toBeCloseTo(110, 6);
  });

  it('puts a body setting due west 90 degrees to the west', () => {
    const p = subPoint(0, 20, 270, 0);
    expect(p.lon).toBeCloseTo(290, 6);
  });

  // Real NASA Horizons values for 2025-03-06 00:00 UTC. Two sites 84 degrees of
  // latitude apart must agree on where the Sun is overhead.
  it('agrees between sites on real NASA positions', () => {
    const fromIm2 = subPoint(-84.78, 29.13, 74.592006, 1.726383);
    expect(fromIm2.lon).toBeCloseTo(103.63, 1);
    expect(fromIm2.lat).toBeCloseTo(-0.33, 1);
  });
});
