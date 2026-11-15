// The incident list (1-12): the next sunrises, sunsets, Earth rises and Earth
// sets across every site, soonest first. Each site's changes come from the one
// calculator (changesFrom on its 30-day result), so the list and the timeline agree.
import { changesFrom, type Change } from '@moon/core';
import { DISPLAY_HOURS } from '../siteData';
import type { SiteRow } from './types';

export interface Incident extends Change {
  site: SiteRow['site'];
  short: string;
}

export function incidents(rows: SiteRow[], landingIso: string): Incident[] {
  return rows
    .flatMap((r) => (r.result ? changesFrom(r.result, landingIso, DISPLAY_HOURS).map((c) => ({ ...c, site: r.site, short: r.short })) : []))
    .sort((a, b) => a.time.localeCompare(b.time) || a.short.localeCompare(b.short));
}
