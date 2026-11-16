import { describe, expect, it } from 'vitest';
import fixture from './fixtures/lola-offsets.json';
import {
  LOLA_RADIUS_M,
  latLonPlain,
  latLonText,
  latLonToOffset,
  lolaForward,
  lolaInverse,
  noTerrainReason,
  offsetToLatLon,
} from './lunarMap.js';

const target = { lat: fixture.target.lat, lon: fixture.target.lon_east };
const dlon = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('LOLA south polar stereographic', () => {
  it('uses the elevation map radius', () => {
    expect(fixture.radius_m).toBe(LOLA_RADIUS_M);
    expect(fixture.projection).toContain('+lat_0=-90 +lat_ts=-90 +lon_0=0');
  });

  it('the target itself returns its listed coordinates', () => {
    const p = offsetToLatLon(target, 0, 0);
    expect(p.lat).toBeCloseTo(-84.78, 10);
    expect(p.lon).toBeCloseTo(29.13, 10);
    expect(latLonText(p.lat, p.lon)).toBe('84.7800 S, 29.1300 E');
  });

  it('matches the terrain tool (pyproj) at every reference offset', () => {
    for (const r of fixture.points) {
      const p = offsetToLatLon(target, r.east, r.north);
      expect(Math.abs(p.lat - r.lat)).toBeLessThan(1e-9);
      expect(dlon(p.lon, r.lon_east)).toBeLessThan(1e-9);
    }
  });

  it('round-trips the tool values back to their offsets (under a millimetre)', () => {
    for (const r of fixture.points) {
      const o = latLonToOffset(target, { lat: r.lat, lon: r.lon_east });
      expect(Math.abs(o.east - r.east)).toBeLessThan(1e-3);
      expect(Math.abs(o.north - r.north)).toBeLessThan(1e-3);
    }
  });

  it('forward and inverse agree across the south polar map', () => {
    for (const [lat, lon] of [[-89.99, 0], [-84, 29.13], [-86.5, 120], [-83.2, 285], [-88, 200]] as const) {
      const back = lolaInverse(lolaForward({ lat, lon }));
      expect(back.lat).toBeCloseTo(lat, 9);
      expect(dlon(back.lon, lon)).toBeLessThan(1e-9);
    }
  });

  it('formats like 84.7839 S, 29.1445 E and copies signed degrees', () => {
    const p = offsetToLatLon(target, 40, -120);
    expect(latLonText(p.lat, p.lon)).toBe('84.7839 S, 29.1445 E');
    expect(latLonPlain(p.lat, p.lon)).toBe('-84.7839, 29.1445');
    expect(latLonText(12.5, -10)).toBe('12.5000 N, 350.0000 E');
    expect(latLonText(-1, 359.99999)).toBe('1.0000 S, 0.0000 E');
  });
});

describe('noTerrainReason', () => {
  it('names the map edge and the cut-off horizon', () => {
    expect(noTerrainReason(-69.37)).toMatch(/outside the south-pole elevation map \(it covers 80 to 90 degrees south\)/);
    expect(noTerrainReason(0.67)).toMatch(/outside/);
    expect(noTerrainReason(-80.13)).toBe('it is at the edge of the map, so the horizon would be cut off');
    expect(noTerrainReason(-86, true)).toMatch(/your own coordinates/);
  });
});
