import { describe, it, expect } from 'vitest';
import { placeSkyLabels, type SkyLabelBox } from './skyLabels';

const overlap = (a: SkyLabelBox, b: SkyLabelBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const BOUNDS = { left: 34, right: 292, top: 12, bottom: 134 };

describe('sky view labels (D)', () => {
  it('leaves labels alone when the Sun and Earth are far apart', () => {
    const [sun, earth] = placeSkyLabels(
      [
        { cx: 60, cy: 40, text: 'SUN +4.4°' },
        { cx: 220, cy: 100, text: 'EARTH +11.0°' },
      ],
      BOUNDS,
    );
    expect(sun!.y).toBe(44);
    expect(earth!.y).toBe(104);
    expect(overlap(sun!.box, earth!.box)).toBe(false);
  });

  it('pulls overlapping labels apart when the two are close together', () => {
    for (const [dx, dy] of [
      [0, 0],
      [8, 3],
      [30, -5],
      [-20, 6],
    ]) {
      const labels = placeSkyLabels(
        [
          { cx: 150, cy: 60, text: 'SUN +4.4°' },
          { cx: 150 + dx!, cy: 60 + dy!, text: 'EARTH +5.0°' },
        ],
        BOUNDS,
      );
      expect(overlap(labels[0]!.box, labels[1]!.box)).toBe(false);
    }
  });

  it('keeps both labels inside the picture near the top and bottom edges', () => {
    for (const cy of [BOUNDS.top, BOUNDS.bottom - 7]) {
      const labels = placeSkyLabels(
        [
          { cx: 150, cy, text: 'SUN +4.4°' },
          { cx: 152, cy, text: 'EARTH +5.0°' },
        ],
        BOUNDS,
      );
      for (const l of labels) {
        expect(l.box.top).toBeGreaterThanOrEqual(BOUNDS.top);
        expect(l.box.bottom).toBeLessThanOrEqual(BOUNDS.bottom + 12);
      }
      expect(overlap(labels[0]!.box, labels[1]!.box)).toBe(false);
    }
  });

  it('puts labels on the left near the right edge so they are not cut off', () => {
    const [l] = placeSkyLabels([{ cx: 280, cy: 60, text: 'EARTH +5.0°' }], BOUNDS);
    expect(l!.anchor).toBe('end');
    expect(l!.box.right).toBeLessThanOrEqual(BOUNDS.right);
  });
});

describe('sky view labels stay off the lines (polish)', () => {
  const crosses = (b: SkyLabelBox, y: number) => b.top < y && y < b.bottom;

  it('moves a label off the horizon and allowance lines', () => {
    const lines = [100, 92];
    for (const cy of [90, 92, 95, 100, 103]) {
      const labels = placeSkyLabels(
        [
          { cx: 120, cy, text: 'SUN +1.7°' },
          { cx: 250, cy: 30, text: 'EARTH +10.9°' },
        ],
        { ...BOUNDS, lines },
      );
      for (const l of labels) for (const y of lines) expect(crosses(l.box, y), `cy ${cy} line ${y}`).toBe(false);
      expect(overlap(labels[0]!.box, labels[1]!.box)).toBe(false);
    }
  });

  it('still separates two close labels while keeping both off the lines', () => {
    const lines = [100, 92];
    const labels = placeSkyLabels(
      [
        { cx: 150, cy: 96, text: 'SUN +1.7°' },
        { cx: 152, cy: 97, text: 'EARTH +2.0°' },
      ],
      { ...BOUNDS, lines },
    );
    expect(overlap(labels[0]!.box, labels[1]!.box)).toBe(false);
    for (const l of labels) for (const y of lines) expect(crosses(l.box, y)).toBe(false);
  });
});
