// The site list in groups: Artemis III candidates, South pole, Apollo, Other
// landers, then the visitor's own sites. A search box filters it once the list
// is long. Artemis III regions are named by NASA but have no published centre
// point, so the group is shown with that reason rather than invented points.

export const GROUP_ORDER = ['Artemis III candidates', 'South pole', 'Apollo', 'Other landers'] as const;
export const OWN_GROUP = 'Your sites';
export const SEARCH_FROM = 12;
export const ARTEMIS_NOTE =
  'NASA has named nine candidate regions but has not published a centre point for any of them, so none is listed yet.';

interface RowLike {
  site: { id: string; name: string; group?: string; custom?: boolean; aim?: unknown };
  short: string;
}

export interface SiteGroupView<R> {
  title: string;
  rows: R[];
  note?: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase();

export function groupSites<R extends RowLike>(rows: R[], query: string): Array<SiteGroupView<R>> {
  const q = fold(query.trim());
  const match = (r: R) => !q || fold(`${r.site.name} ${r.short}`).includes(q);
  const groups: Array<SiteGroupView<R>> = GROUP_ORDER.map((title) => ({
    title,
    rows: rows.filter((r) => !r.site.custom && !r.site.aim && r.site.group === title && match(r)),
    ...(title === 'Artemis III candidates' ? { note: ARTEMIS_NOTE } : {}),
  }));
  // Anything without a known group (the visitor's own points, the Miss aim, an older list).
  groups.push({
    title: OWN_GROUP,
    rows: rows.filter((r) => (r.site.custom || r.site.aim || !GROUP_ORDER.includes(r.site.group as never)) && match(r)),
  });
  return groups.filter((g) => g.rows.length > 0 || (!q && g.note));
}
