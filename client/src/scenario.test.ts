import { describe, it, expect } from 'vitest';
import { DEFAULT_SCENARIO, parseScenario, scenarioToQuery, slipDate, type Scenario } from './scenario';

describe('scenario in the page address (1-6)', () => {
  it('round-trips every field', () => {
    const s: Scenario = {
      site: 'shk',
      date: '2025-03-16',
      hour: 12,
      margin: 3.5,
      accuracy: 320,
      aim: { east: -150, north: 50 },
      t: 12,
    };
    const parsed = parseScenario(new URLSearchParams(scenarioToQuery(s)));
    expect(parsed.scenario).toEqual(s);
    expect(parsed.notices).toEqual([]);
    expect(parsed.present).toBe(true);
  });

  it('uses the defaults for an empty address and reports no scenario present', () => {
    const parsed = parseScenario(new URLSearchParams(''));
    expect(parsed.scenario).toEqual(DEFAULT_SCENARIO);
    expect(parsed.present).toBe(false);
  });

  it('ignores junk values without failing', () => {
    const parsed = parseScenario(new URLSearchParams('site=im1&hour=99&margin=abc&accuracy=7&aim=x,y&t=400'));
    expect(parsed.scenario).toEqual({ ...DEFAULT_SCENARIO, site: 'im1' });
  });
});

describe('allowed dates (1-13)', () => {
  it('a 2050 date opens the default date and says why', () => {
    const parsed = parseScenario(new URLSearchParams('site=im2&date=2050-01-01'));
    expect(parsed.scenario.date).toBe(DEFAULT_SCENARIO.date);
    expect(parsed.notices.length).toBe(1);
    expect(parsed.notices[0]).toContain('2050-01-01');
    expect(parsed.notices[0]).toContain('2020-01-01 to 2040-12-31');
    expect(parsed.notices[0]).toContain(DEFAULT_SCENARIO.date);
  });

  it('refuses impossible and malformed dates the same way', () => {
    expect(parseScenario(new URLSearchParams('date=2025-02-31')).notices.length).toBe(1);
    expect(parseScenario(new URLSearchParams('date=tomorrow')).notices.length).toBe(1);
    expect(parseScenario(new URLSearchParams('date=2019-12-31')).notices.length).toBe(1);
  });

  it('accepts the edges of the range', () => {
    expect(parseScenario(new URLSearchParams('date=2020-01-01')).scenario.date).toBe('2020-01-01');
    expect(parseScenario(new URLSearchParams('date=2040-12-31')).scenario.date).toBe('2040-12-31');
  });
});

describe('slipDate (1-5)', () => {
  it('moves by whole days across month ends', () => {
    expect(slipDate('2025-03-06', 10)).toBe('2025-03-16');
    expect(slipDate('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('stays inside the allowed dates', () => {
    expect(slipDate('2040-12-31', 10)).toBe('2040-12-31');
    expect(slipDate('2020-01-01', -1)).toBe('2020-01-01');
  });
});
