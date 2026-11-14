import { describe, it, expect } from 'vitest';
import { normalizeAzimuth, toEastLongitude, clampMargin } from './direction.js';

describe('normalizeAzimuth', () => {
  it('folds into [0, 360)', () => {
    expect(normalizeAzimuth(0)).toBe(0);
    expect(normalizeAzimuth(360)).toBe(0);
    expect(normalizeAzimuth(370)).toBe(10);
    expect(normalizeAzimuth(-10)).toBe(350);
    expect(normalizeAzimuth(-370)).toBe(350);
  });
});

describe('toEastLongitude', () => {
  it('maps negative (west) longitudes to east degrees', () => {
    expect(toEastLongitude(-30)).toBe(330);
    expect(toEastLongitude(29.13)).toBeCloseTo(29.13, 5);
  });
});

describe('clampMargin', () => {
  it('clamps to the locked 0..5 range', () => {
    expect(clampMargin(-1)).toBe(0);
    expect(clampMargin(2)).toBe(2);
    expect(clampMargin(9)).toBe(5);
  });
});
