import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHorizons } from '../src/horizons/parse.js';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

const sunText = read('horizons_sun_im2_2025-03-06_08.txt');
const earthText = read('horizons_earth_im2_2025-03-06_08.txt');

describe('parseHorizons (F-1: parsed rows equal NASA output)', () => {
  it('parses every hourly Sun row', () => {
    const rows = parseHorizons(sunText, 'sun');
    expect(rows.length).toBe(49);
    expect(rows[0]).toEqual({
      body: 'sun',
      time: '2025-03-06T00:00:00Z',
      azimuthDeg: 74.592006,
      elevationDeg: 1.726383,
    });
    // Hourly and monotonic in time.
    expect(rows[1]!.time).toBe('2025-03-06T01:00:00Z');
    expect(rows.at(-1)!.time).toBe('2025-03-08T00:00:00Z');
  });

  it('parses the Earth series including the final row', () => {
    const rows = parseHorizons(earthText, 'earth');
    expect(rows.length).toBe(49);
    expect(rows[0]).toEqual({
      body: 'earth',
      time: '2025-03-06T00:00:00Z',
      azimuthDeg: 335.35078,
      elevationDeg: 10.854318,
    });
    expect(rows.at(-1)).toEqual({
      body: 'earth',
      time: '2025-03-08T00:00:00Z',
      azimuthDeg: 336.533211,
      elevationDeg: 11.304757,
    });
  });

  it('throws when there is no data block', () => {
    expect(() => parseHorizons('no markers here', 'sun')).toThrow();
  });
});
