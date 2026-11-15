// The two sides of Compare. Side A is the shared scenario's place, date and hour
// (so slips and site picks elsewhere carry over). Side B is either derived from
// side A by a quick setup, or set by hand.
import { slipDate, type CompareSetup, type CompareSide, type Scenario } from '../scenario';

export interface QuickSetup {
  key: Exclude<CompareSetup, 'custom'>;
  label: string;
}

/** The quick setups that work today, in the prototype's order and wording. */
export const QUICK_SETUPS: QuickSetup[] = [
  { key: 'date', label: 'SAME PLACE, 10 DAYS LATER' },
  { key: 'time', label: 'SAME DAY, 12 HOURS LATER' },
  { key: 'site', label: 'TWO SITES' },
];

export function sideA(s: Scenario): CompareSide {
  return { site: s.site, date: s.date, hour: s.hour };
}

/** Side B for a quick setup, filled from side A. */
export function quickSideB(key: QuickSetup['key'], a: CompareSide, siteIds: string[]): CompareSide {
  switch (key) {
    case 'date':
      return { site: a.site, date: slipDate(a.date, 10), hour: a.hour };
    case 'time':
      return { site: a.site, date: a.date, hour: (a.hour + 12) % 24 };
    case 'site':
      return { site: siteIds.find((id) => id !== a.site) ?? a.site, date: a.date, hour: a.hour };
  }
}

export function sideB(s: Scenario, siteIds: string[]): CompareSide {
  const a = sideA(s);
  if (s.setup === 'custom' && s.b) {
    // A hand-set site that is no longer in the list falls back to side A's site.
    const site = siteIds.length === 0 || siteIds.includes(s.b.site) ? s.b.site : a.site;
    return { ...s.b, site };
  }
  return quickSideB(s.setup === 'custom' ? 'date' : s.setup, a, siteIds);
}

export const sameSide = (x: CompareSide, y: CompareSide): boolean =>
  x.site === y.site && x.date === y.date && x.hour === y.hour;
