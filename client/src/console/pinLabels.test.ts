import { describe, it, expect } from 'vitest';
import { placePinLabels } from './pinLabels';

const overlap = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('pole map labels never overlap (D)', () => {
  it('keeps far-apart labels on the right of their pins', () => {
    const out = placePinLabels([
      { id: 'a', x: 100, y: 100, text: 'IM-1' },
      { id: 'b', x: 300, y: 300, text: 'Shackleton' },
    ], 'a');
    expect(out.map((l) => l.side)).toEqual(['right', 'right']);
  });

  it('moves or hides a crowded label, and the selected one always shows', () => {
    const out = placePinLabels([
      { id: 'im2a', x: 202, y: 201, text: 'IM-2 actual' },
      { id: 'im2', x: 200, y: 200, text: 'IM-2' },
      { id: 'x', x: 204, y: 202, text: 'Another' },
    ], 'im2');
    const shown = out.filter((l) => l.side !== 'hidden');
    expect(out.find((l) => l.id === 'im2')!.side).not.toBe('hidden');
    for (let i = 0; i < shown.length; i++)
      for (let j = i + 1; j < shown.length; j++) expect(overlap(shown[i]!.box, shown[j]!.box)).toBe(false);
    expect(out.some((l) => l.side === 'left' || l.side === 'hidden')).toBe(true);
  });
});
