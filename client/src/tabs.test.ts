import { describe, it, expect } from 'vitest';
import { TABS } from './tabs.js';

describe('TABS', () => {
  it('has the five sections with unique addresses', () => {
    const labels = TABS.map((t) => t.label);
    expect(labels).toEqual(['CONSOLE', 'COMPARE', 'MISS', 'WATCH', 'API']);
    const paths = new Set(TABS.map((t) => t.path));
    expect(paths.size).toBe(TABS.length);
  });

  it('gives every tab its own title and description (E-1)', () => {
    for (const t of TABS) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.description.length).toBeLessThanOrEqual(200);
    }
    expect(new Set(TABS.map((t) => t.title)).size).toBe(TABS.length);
    expect(new Set(TABS.map((t) => t.description)).size).toBe(TABS.length);
  });
});
