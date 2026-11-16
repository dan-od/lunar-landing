import { describe, expect, it } from 'vitest';
import { CURATED_SITES as SITES } from '@moon/core';
import { missSiteOptions } from './siteOptions';

describe('Miss Site dropdown options', () => {
  it('lists the three terrain sites first, then every other site marked (no terrain)', () => {
    const sites = SITES.map((s) => ({ id: s.id, name: s.name, has_terrain: s.hasTerrain }));
    const { terrain, others } = missSiteOptions(sites);
    expect(terrain.map((o) => o.id).sort()).toEqual(['im2', 'im2a', 'shk']);
    expect(terrain.every((o) => !o.label.includes('no terrain'))).toBe(true);
    expect(others).toHaveLength(sites.length - 3);
    expect(others.every((o) => o.label.endsWith(' (no terrain)'))).toBe(true);
    expect(others.map((o) => o.id)).toContain('ap11');
  });

  it('never lists the aim point, and a custom site counts as no terrain', () => {
    const { terrain, others } = missSiteOptions([
      { id: 'im2', name: 'IM-2', has_terrain: true },
      { id: 'aim', name: 'Aim', has_terrain: true, aim: true },
      { id: 'c1', name: 'Mine', has_terrain: true, custom: true },
    ]);
    expect(terrain).toEqual([{ id: 'im2', label: 'IM-2' }]);
    expect(others).toEqual([{ id: 'c1', label: 'Mine (no terrain)' }]);
  });
});
