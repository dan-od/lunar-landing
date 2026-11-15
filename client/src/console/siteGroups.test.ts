import { describe, it, expect } from 'vitest';
import { groupSites, SEARCH_FROM } from './siteGroups';

const s = (id: string, name: string, group?: string, custom = false) => ({ site: { id, name, group, custom, aim: undefined }, short: name });

const rows = [
  s('im2', 'IM-2 target', 'South pole'),
  s('a12', 'Apollo 12 lunar module', 'Apollo'),
  s('ap11', 'Apollo 11 lunar module', 'Apollo'),
  s('ce4', "Chang'e 4 lander", 'Other landers'),
  s('c:-85,30', 'My spot', undefined, true),
];

describe('site list groups and search', () => {
  it('groups in the fixed order and shows no empty group (no Artemis III group)', () => {
    const g = groupSites(rows, '');
    expect(g.map((x) => x.title)).toEqual(['South pole', 'Apollo', 'Other landers', 'Your sites']);
    expect(g.every((x) => x.rows.length > 0)).toBe(true);
    expect(g[1]!.rows.map((r) => r.site.id)).toEqual(['a12', 'ap11']);
    expect(g[3]!.rows.map((r) => r.site.id)).toEqual(['c:-85,30']);
  });

  it('searches names, ignoring case and accents, and hides empty groups while searching', () => {
    const g = groupSites(rows, 'apollo 1');
    expect(g.map((x) => x.title)).toEqual(['Apollo']);
    expect(groupSites(rows, 'change').flatMap((x) => x.rows.map((r) => r.site.id))).toEqual(['ce4']);
    expect(groupSites(rows, 'zzz')).toEqual([]);
  });

  it('offers search once the list passes about twelve entries', () => {
    expect(SEARCH_FROM).toBe(12);
  });
});
