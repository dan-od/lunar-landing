import { describe, it, expect } from 'vitest';
import { mapCredit, isCoarse, coarseNote, preparingText } from './terrainCredit';

describe('terrain credit', () => {
  it('names the resolution', () => {
    expect(mapCredit(80)).toBe('terrain from LOLA 80 m');
    expect(mapCredit(120)).toBe('terrain from LOLA 120 m');
    expect(mapCredit(237)).toBe('terrain from LOLA 237 m');
    expect(mapCredit(null)).toBe('terrain from the LOLA elevation map');
  });

  it('flags the coarse whole-Moon map', () => {
    expect(isCoarse(80)).toBe(false);
    expect(isCoarse(120)).toBe(false);
    expect(isCoarse(237)).toBe(true);
    expect(coarseNote(120)).toBeNull();
    expect(coarseNote(237)).toContain('coarser than the polar maps');
  });

  it('names the map while preparing when known', () => {
    expect(preparingText(null)).toBe('Preparing terrain…');
    expect(preparingText({ map: 'LDEM_60S_120M' } as never)).toContain('LDEM_60S_120M');
  });
});
