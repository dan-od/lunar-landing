// The Miss tab's Site dropdown: sites with prepared terrain first, then the
// others marked "(no terrain)". The aim point is never listed: it belongs to
// the terrain site it was moved from.
export interface SiteLike {
  id: string;
  name: string;
  has_terrain?: boolean;
  aim?: unknown;
  custom?: boolean;
}

export interface SiteOption {
  id: string;
  label: string;
}

export function missSiteOptions(sites: SiteLike[]): { terrain: SiteOption[]; others: SiteOption[] } {
  const listed = sites.filter((s) => !s.aim);
  const hasTerrain = (s: SiteLike) => Boolean(s.has_terrain) && !s.custom;
  return {
    terrain: listed.filter(hasTerrain).map((s) => ({ id: s.id, label: s.name })),
    others: listed.filter((s) => !hasTerrain(s)).map((s) => ({ id: s.id, label: `${s.name} (no terrain)` })),
  };
}
