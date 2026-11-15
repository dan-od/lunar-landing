import { describe, it, expect } from 'vitest';
import { DEFAULT_SCENARIO, nowUtc, parseScenario, scenarioToQuery, shiftDate, slipDate, type Scenario } from './scenario';

describe('the Now button (A)', () => {
  it('gives the current UTC date and hour, not local time', () => {
    // 23:30 on 15 Nov in UTC is still the 15th, whatever the browser's time zone.
    expect(nowUtc(Date.parse('2026-11-15T23:30:00Z'))).toEqual({ date: '2026-11-15', hour: 23 });
    expect(nowUtc(Date.parse('2026-11-16T00:05:00Z'))).toEqual({ date: '2026-11-16', hour: 0 });
  });

  it('keeps the 2025 IM-2 case as the opening default', () => {
    expect(DEFAULT_SCENARIO).toMatchObject({ site: 'im2', date: '2025-03-06', hour: 0 });
  });
});

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
    for (const q of ['cmp=custom', 'b=ch3,2150-01-01,3', 'b=ch3,2025-04-01,99', 'cmp=nonsense']) {
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
  it('a 2150 date opens the default date and says why', () => {
    const parsed = parseScenario(new URLSearchParams('site=im2&date=2150-01-01'));
    expect(parsed.scenario.date).toBe(DEFAULT_SCENARIO.date);
    expect(parsed.notices.length).toBe(1);
    expect(parsed.notices[0]).toContain('2150-01-01');
    expect(parsed.notices[0]).toContain('1960-01-01 to 2100-12-31');
    expect(parsed.notices[0]).toContain(DEFAULT_SCENARIO.date);
  });

  it('refuses impossible and malformed dates the same way', () => {
    expect(parseScenario(new URLSearchParams('date=2025-02-31')).notices.length).toBe(1);
    expect(parseScenario(new URLSearchParams('date=tomorrow')).notices.length).toBe(1);
    expect(parseScenario(new URLSearchParams('date=1959-12-31')).notices.length).toBe(1);
  });

  it('accepts the edges of the range', () => {
    expect(parseScenario(new URLSearchParams('date=1960-01-01')).scenario.date).toBe('1960-01-01');
    expect(parseScenario(new URLSearchParams('date=2100-12-31')).scenario.date).toBe('2100-12-31');
  });
});

describe('slipDate (1-5)', () => {
  it('moves by whole days across month ends', () => {
    expect(slipDate('2025-03-06', 10)).toBe('2025-03-16');
    expect(slipDate('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('stays inside the allowed dates', () => {
    expect(slipDate('2100-12-31', 10)).toBe('2100-12-31');
    expect(slipDate('1960-01-01', -1)).toBe('1960-01-01');
  });
});

describe('wider allowed dates (G)', () => {
  it('accepts Apollo 11 (1969) and dates up to 2100, refuses 2101', () => {
    expect(parseScenario(new URLSearchParams('date=1969-07-20')).scenario.date).toBe('1969-07-20');
    expect(parseScenario(new URLSearchParams('date=2099-06-01')).scenario.date).toBe('2099-06-01');
    expect(parseScenario(new URLSearchParams('date=2101-01-01')).notices[0]).toContain('1960-01-01 to 2100-12-31');
  });
});

describe('month and year steps (C)', () => {
  it('moves by calendar months and years, keeping the day where it exists', () => {
    expect(shiftDate('2025-03-06', { months: 1 })).toBe('2025-04-06');
    expect(shiftDate('2025-03-06', { months: -1 })).toBe('2025-02-06');
    expect(shiftDate('2025-12-15', { months: 1 })).toBe('2026-01-15');
    expect(shiftDate('2025-03-06', { years: 1 })).toBe('2026-03-06');
    expect(shiftDate('2025-03-06', { years: -1 })).toBe('2024-03-06');
  });

  it('lands on the last day of a shorter month', () => {
    expect(shiftDate('2025-01-31', { months: 1 })).toBe('2025-02-28');
    expect(shiftDate('2024-02-29', { years: 1 })).toBe('2025-02-28');
  });

  it('stays inside the allowed dates', () => {
    expect(shiftDate('2100-12-15', { months: 1 })).toBe('2100-12-31');
    expect(shiftDate('1960-01-15', { years: -1 })).toBe('1960-01-01');
  });
});
