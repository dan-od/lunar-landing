import { describe, it, expect } from 'vitest';
import { mapCredit, isCoarse, needsCoarseCaution, preparingText } from './terrainCredit';

describe('terrain credit', () => {
  it('names the map and resolution', () => {
    expect(mapCredit('LDEM_80S_80MPP', 80)).toBe('Terrain from LOLA south polar map, 80 m.');
    expect(mapCredit('LDEM_60S_120M', 120)).toBe('Terrain from LOLA south polar map, 120 m.');
    expect(mapCredit('LDEM_60N_120M', 120)).toBe('Terrain from LOLA north polar map, 120 m.');
    expect(mapCredit(null, null)).toBe('Terrain from the LOLA elevation map.');
  });

  it('flags the coarse whole-Moon map plainly', () => {
    expect(isCoarse(80)).toBe(false);
    expect(isCoarse(120)).toBe(false);
    expect(isCoarse(237)).toBe(true);
    expect(mapCredit('LDEM_128', 237)).toBe('Terrain from LOLA global map, about 240 m: small craters are not seen.');
  });

  it('cautions for any map coarser than the 80 m base map', () => {
    expect(needsCoarseCaution(80)).toBe(false); // the fine south-pole map: no caution
    expect(needsCoarseCaution(120)).toBe(true); // 120 m polar maps
    expect(needsCoarseCaution(237)).toBe(true); // whole-Moon map
    expect(needsCoarseCaution(null)).toBe(false);
    expect(needsCoarseCaution(undefined)).toBe(false);
  });

  it('names the map while preparing when known', () => {
    expect(preparingText(null)).toBe('Preparing terrain…');
    expect(preparingText({ map: 'LDEM_128' } as never)).toBe('Preparing lola global map terrain…');
  });
});
