import { describe, it, expect } from 'vitest';
import { missLabelSpots, spotsOverlap } from './missLabels';

describe('Miss map labels', () => {
  it('keeps AIM clear of ORIGINAL TARGET wherever the aim is near the target', () => {
    for (let east = -200; east <= 200; east += 20) {
      for (let north = -200; north <= 200; north += 20) {
        const s = missLabelSpots({ east, north }, 760);
        expect(spotsOverlap(s.aim, s.target, 0)).toBe(false);
      }
    }
  });

  it('puts AIM above and to the right of the aim when there is room', () => {
    const s = missLabelSpots({ east: 400, north: 400 }, 760);
    expect(s.aim).toMatchObject({ x: 414, y: -416 });
  });
});
