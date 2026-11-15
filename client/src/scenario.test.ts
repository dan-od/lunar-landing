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
      setup: 'custom',
      b: { site: 'ch3', date: '2025-04-01', hour: 21 },
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

describe('compare state in the address (3-1, 3-2)', () => {
  it('keeps a quick setup and drops any hand-set side B with it', () => {
    const parsed = parseScenario(new URLSearchParams('site=im2&cmp=time&b=ch3,2025-04-01,21'));
    expect(parsed.scenario.setup).toBe('time');
    expect(parsed.scenario.b).toBeNull();
    expect(scenarioToQuery(parsed.scenario)).toContain('cmp=time');
  });

  it('falls back to the default setup when side B is unusable', () => {
    for (const q of ['cmp=custom', 'b=ch3,2050-01-01,3', 'b=ch3,2025-04-01,99', 'cmp=nonsense']) {
      const parsed = parseScenario(new URLSearchParams(`site=im2&${q}`));
      expect(parsed.scenario.setup).toBe('date');
      expect(parsed.scenario.b).toBeNull();
    }
  });

  it('keeps "target vs my aim" only while an aim has been moved', () => {
    const withAim = parseScenario(new URLSearchParams('site=im2&cmp=aim&aim=-160,120'));
    expect(withAim.scenario.setup).toBe('aim');
    expect(scenarioToQuery(withAim.scenario)).toContain('cmp=aim');
    expect(parseScenario(new URLSearchParams('site=im2&cmp=aim')).scenario.setup).toBe('date');
  });

  it('leaves the default setup out of the address', () => {
    expect(scenarioToQuery(DEFAULT_SCENARIO)).not.toContain('cmp');
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
