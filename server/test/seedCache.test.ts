import { describe, it, expect } from 'vitest';
import { seedSpans } from '../src/cache/seedCache.js';

describe('deploy seed spans (A)', () => {
  it('seeds the 2025 case, the Apollo 11 landing day and the 60 days starting today (UTC)', () => {
    const spans = seedSpans(Date.parse('2026-11-15T11:30:00Z'));
    expect(spans).toEqual([
      { start: '2025-02-04 00:00', stop: '2025-04-05 00:00', step: '1h' },
      { start: '1969-07-20 00:00', stop: '1969-07-21 00:00', step: '1h' },
      { start: '2026-11-15 00:00', stop: '2027-01-14 00:00', step: '1h' },
    ]);
  });
});
