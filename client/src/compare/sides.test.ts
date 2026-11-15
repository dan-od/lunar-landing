import { describe, it, expect } from 'vitest';
import { DEFAULT_SCENARIO, type Scenario } from '../scenario';
import { quickSideB, sideA, sideB } from './sides';

const IDS = ['im2', 'im1', 'shk', 'ch3', 'ap11'];
const base: Scenario = { ...DEFAULT_SCENARIO, site: 'im1', date: '2025-03-06', hour: 15 };

describe('quick setups fill both sides from the scenario (3-2)', () => {
  it('side A is always the scenario', () => {
    expect(sideA(base)).toEqual({ site: 'im1', date: '2025-03-06', hour: 15 });
  });

  it('same place, 10 days later', () => {
    expect(sideB({ ...base, setup: 'date' }, IDS)).toEqual({ site: 'im1', date: '2025-03-16', hour: 15 });
  });

  it('same day, 12 hours later', () => {
    expect(sideB({ ...base, setup: 'time' }, IDS)).toEqual({ site: 'im1', date: '2025-03-06', hour: 3 });
    expect(quickSideB('time', { site: 'im1', date: '2025-03-06', hour: 0 }, IDS).hour).toBe(12);
  });

  it('two sites: the first other site, same date and hour', () => {
    expect(sideB({ ...base, setup: 'site' }, IDS)).toEqual({ site: 'im2', date: '2025-03-06', hour: 15 });
    expect(sideB({ ...base, site: 'im2', setup: 'site' }, IDS).site).toBe('im1');
  });

  it('a quick setup follows the scenario when the landing date slips', () => {
    expect(sideB({ ...base, date: '2025-03-07', setup: 'date' }, IDS).date).toBe('2025-03-17');
  });
});

describe('target vs my aim (3-2, 4-6)', () => {
  it('pairs the scenario site with the aim point from the Miss tab', () => {
    const s: Scenario = { ...base, site: 'im2', setup: 'aim', aim: { east: -160, north: 120 } };
    expect(sideA(s)).toEqual({ site: 'im2', date: '2025-03-06', hour: 15 });
    expect(sideB(s, [...IDS, 'aim'])).toEqual({ site: 'aim', date: '2025-03-06', hour: 15 });
  });

  it('"two sites" never picks the aim point as the other site', () => {
    const s: Scenario = { ...base, site: 'im2', setup: 'site', aim: { east: 40, north: 0 } };
    expect(sideB(s, ['im2', 'aim', 'im1']).site).toBe('im1');
  });
});

describe('any pairing can be set by hand (3-1)', () => {
  it('uses the hand-set side B as it is', () => {
    const b = { site: 'ap11', date: '2025-02-20', hour: 7 };
    expect(sideB({ ...base, setup: 'custom', b }, IDS)).toEqual(b);
  });

  it('allows the same place and time on both sides', () => {
    const b = { site: 'im1', date: '2025-03-06', hour: 15 };
    expect(sideB({ ...base, setup: 'custom', b }, IDS)).toEqual(sideA(base));
  });

  it('falls back to side A’s site when the hand-set site is not in the list', () => {
    const b = { site: 'gone', date: '2025-02-20', hour: 7 };
    expect(sideB({ ...base, setup: 'custom', b }, IDS).site).toBe('im1');
  });
});
