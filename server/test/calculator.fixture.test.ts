// F-4: window calculator unit checks on a saved NASA reply at allowances 0, 2, 5.
// The IM-2 touchdown (2025-03-06 00:00 UTC) has a very low Sun (1.73 deg) and a
// well-placed Earth (10.85 deg), so the margin matters exactly where it should.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeResult, summarizeSeries } from '@moon/core';
import { parseHorizons } from '../src/horizons/parse.js';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

const sun = parseHorizons(read('horizons_sun_im2_2025-03-06_08.txt'), 'sun');
const earth = parseHorizons(read('horizons_earth_im2_2025-03-06_08.txt'), 'earth');

describe('calculator on the saved IM-2 reply (F-4)', () => {
  it('Sun uptime changes with the allowance (0 / 2 / 5 deg)', () => {
    expect(summarizeSeries(sun, 0).uptimePct).toBe(100); // 49/49 above 0
    expect(summarizeSeries(sun, 2).uptimePct).toBe(86); // 42/49 above 2
    expect(summarizeSeries(sun, 5).uptimePct).toBe(0); // none above 5 (max 3.6)
  });

  it('Earth contact holds at every allowance', () => {
    for (const m of [0, 2, 5]) {
      expect(summarizeSeries(earth, m).uptimePct).toBe(100);
    }
  });

  it('landing state at touchdown follows the allowance', () => {
    expect(computeResult(sun, earth, { marginDeg: 0 }).landing.word).toBe('READY');
    expect(computeResult(sun, earth, { marginDeg: 2 }).landing.word).toBe('NO POWER');
    expect(computeResult(sun, earth, { marginDeg: 5 }).landing.word).toBe('NO POWER');
  });

  it('names the model used on every result', () => {
    expect(computeResult(sun, earth, { marginDeg: 2 }).model).toBe('smooth Moon');
    expect(computeResult(sun, earth, { marginDeg: 2, model: 'terrain' }).model).toBe('terrain');
  });
});
