import { describe, it, expect } from 'vitest';
import { CURATED_SITES, SITE_GROUPS, getCuratedSite } from './sites.js';

describe('curated site list (F-5)', () => {
  it('ships at least five sites', () => {
    expect(CURATED_SITES.length).toBeGreaterThanOrEqual(5);
  });

  it('gives every site a non-empty cited source', () => {
    for (const s of CURATED_SITES) {
      expect(s.source.trim().length).toBeGreaterThan(0);
      expect(s.source).toMatch(/https?:\/\//);
    }
  });

  it('has unique ids and valid coordinates', () => {
    const ids = new Set(CURATED_SITES.map((s) => s.id));
    expect(ids.size).toBe(CURATED_SITES.length);
    for (const s of CURATED_SITES) {
      expect(s.lat).toBeGreaterThanOrEqual(-90);
      expect(s.lat).toBeLessThanOrEqual(90);
      expect(s.lon).toBeGreaterThanOrEqual(-180);
      expect(s.lon).toBeLessThanOrEqual(360);
    }
  });

  it('marks exactly the demo site as having terrain', () => {
    const withTerrain = CURATED_SITES.filter((s) => s.hasTerrain).map((s) => s.id);
    expect(withTerrain).toEqual(['im2']);
  });

  it('looks up by id', () => {
    expect(getCuratedSite('ap11')?.short).toBe('Apollo 11');
    expect(getCuratedSite('nope')).toBeUndefined();
  });
});

describe('grown site list (grouped, every site cited)', () => {
  it('puts every site in one of the four groups', () => {
    for (const s of CURATED_SITES) {
      expect(SITE_GROUPS).toContain(s.group);
    }
  });

  it('includes the other Apollo landings and recent landers, each with its own link', () => {
    for (const id of ['a12', 'a14', 'a15', 'a16', 'a17', 'ce3', 'ce4', 'ce5', 'ce6', 'slim', 'bg1', 'luna25', 'vikram', 'beresheet', 'hakuto1', 'im2a']) {
      const s = getCuratedSite(id);
      expect(s, id).toBeDefined();
      expect(s!.source).toMatch(/^[^,]+, https:\/\//);
    }
  });

  it('keeps terrain for the IM-2 target only', () => {
    expect(getCuratedSite('im2a')?.hasTerrain).toBe(false);
  });
});
