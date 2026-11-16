import { describe, expect, it } from 'vitest';
import { offsetWords } from './offsetWords';

describe('offsetWords', () => {
  it('names east/west then north/south, rounded to whole metres', () => {
    expect(offsetWords({ east: 40, north: -120 })).toBe('40 m east, 120 m south of the target');
    expect(offsetWords({ east: -160.4, north: 0.3 })).toBe('160 m west of the target');
    expect(offsetWords({ east: 0, north: 0 })).toBe('the original target');
  });
});
