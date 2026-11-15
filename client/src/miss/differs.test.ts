import { describe, it, expect } from 'vitest';
import type { SiteState } from '@moon/core';
import { differsNote, targetWorks } from './differs';

const st = (word: SiteState['word'], symbol: string): SiteState => ({ word, symbol, powerUp: false, linkUp: false });

describe('Miss explains when it differs from the Console', () => {
  it('reads the point at the original target', () => {
    const grid = [
      { east: 0, north: 0, works: true },
      { east: 20, north: 0, works: false },
    ];
    expect(targetWorks(grid, 20)).toBe(true);
    expect(targetWorks([{ east: 20, north: 0, works: false }], 20)).toBeUndefined();
  });

  it('says nothing when they agree, and names both models when they do not', () => {
    expect(differsNote(st('READY', '●'), true, 'IM-2', '2025-03-06 00:00')).toBeNull();
    expect(differsNote(st('NO POWER', '▲'), false, 'IM-2', '2025-03-06 00:00')).toBeNull();
    const note = differsNote(st('NO POWER', '▲'), true, 'IM-2', '2025-03-06 00:00')!;
    expect(note).toContain('▲ NO POWER for IM-2 at 2025-03-06 00:00 UTC');
    expect(note).toContain('smooth-Moon model at that one hour');
    expect(note).toContain('90% of the first 10 days');
    expect(note).toContain('it does.');
  });
});
