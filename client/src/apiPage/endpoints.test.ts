import { describe, it, expect } from 'vitest';
import { DEFAULT_SCENARIO, type Scenario } from '../scenario';
import { ENDPOINTS, endpointUrl, previewJson } from './endpoints';

const s: Scenario = { ...DEFAULT_SCENARIO, site: 'shk', date: '2025-03-10', hour: 9, margin: 1.5, accuracy: 320 };

describe('endpointUrl: each endpoint is called for the current scenario', () => {
  it('builds a request for every listed endpoint', () => {
    for (const e of ENDPOINTS) {
      expect(endpointUrl(e.key, s, 'im2').startsWith(e.path)).toBe(true);
    }
  });

  it('sky and windows carry place, date, hour and allowance', () => {
    expect(endpointUrl('sky', s, 'im2')).toBe('/v1/sky?site=shk&date=2025-03-10&hour=9&margin=1.5');
    expect(endpointUrl('windows', s, 'im2')).toBe(
      '/v1/windows?site=shk&start=2025-03-10&hour=9&days=30&margin=1.5',
    );
    expect(endpointUrl('csv', s, 'im2')).toBe(
      '/v1/windows.csv?site=shk&start=2025-03-10&hour=9&days=30&margin=1.5',
    );
  });

  it('report compares the scenario with the same place ten days later', () => {
    expect(endpointUrl('report', s, 'im2')).toBe(
      '/v1/report?a_site=shk&a_date=2025-03-10&a_hour=9&b_site=shk&b_date=2025-03-20&b_hour=9&margin=1.5',
    );
  });

  it('miss always asks about the site that has terrain, with the aim and accuracy', () => {
    const withAim = { ...s, aim: { east: -160, north: 120 } };
    expect(endpointUrl('miss', withAim, 'im2')).toBe(
      '/v1/miss?site=im2&date=2025-03-10&hour=9&east=-160&north=120&accuracy=320',
    );
  });

  it('sends the aim point as its terrain site plus the offset', () => {
    const onAim = { ...s, site: 'aim', aim: { east: 40, north: -80 } };
    expect(endpointUrl('windows', onAim, 'im2')).toBe(
      '/v1/windows?site=im2&start=2025-03-10&hour=9&days=30&margin=1.5&aim_east=40&aim_north=-80',
    );
    expect(endpointUrl('sky', onAim, 'im2')).toContain('site=im2');
  });
});

describe('previewJson', () => {
  it('cuts long lists and says how many were left out', () => {
    const text = previewJson({ model: 'smooth Moon', series: [{ t: 1 }, { t: 2 }, { t: 3 }, { t: 4 }, { t: 5 }] });
    const parsed = JSON.parse(text) as { model: string; series: unknown[] };
    expect(parsed.model).toBe('smooth Moon');
    expect(parsed.series).toEqual([{ t: 1 }, { t: 2 }, { t: 3 }, '… 2 more']);
  });

  it('leaves short lists and plain values alone', () => {
    expect(JSON.parse(previewJson({ a: [1, 2], b: 'x', c: null }))).toEqual({ a: [1, 2], b: 'x', c: null });
  });
});
