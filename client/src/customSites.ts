// Custom coordinates (flow 2). A custom site's id carries its coordinates
// ("c:-85.2,31.5"), so a shared link to it works for anyone. The name a visitor
// gives it is kept only in their own browser.

const PREFIX = 'c:';
const STORAGE_KEY = 'moon:custom-sites';
export const NAME_MAX = 60;

export interface CustomSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** Four decimals is about three metres on the Moon: more than the model resolves. */
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

export function customId(lat: number, lon: number): string {
  return `${PREFIX}${round4(lat)},${round4(lon)}`;
}

/** The coordinates in a custom site id, or null if it is not one (or is out of range). */
export function parseCustomId(id: string): { lat: number; lon: number } | null {
  if (!id.startsWith(PREFIX)) return null;
  const parts = id.slice(PREFIX.length).split(',');
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (parts[0]!.trim() === '' || parts[1]!.trim() === '') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 360) return null;
  return { lat, lon };
}

export type CoordinateCheck =
  | { ok: true; lat: number; lon: number }
  | { ok: false; field: 'lat' | 'lon'; message: string };

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/** Check what was typed. A bad value names its field so the message can sit above it (2-2). */
export function checkCoordinates(latText: string, lonText: string): CoordinateCheck {
  const lat = Number(latText.trim());
  if (!NUMBER_RE.test(latText.trim()) || lat < -90 || lat > 90) {
    return { ok: false, field: 'lat', message: 'Latitude must be a number from -90 to 90.' };
  }
  const lon = Number(lonText.trim());
  if (!NUMBER_RE.test(lonText.trim()) || lon < -180 || lon > 360) {
    return { ok: false, field: 'lon', message: 'Longitude must be a number from -180 to 360.' };
  }
  return { ok: true, lat: round4(lat), lon: round4(lon) };
}

/** A name as it will be kept: trimmed, single-spaced, limited in length. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

export function loadCustomSites(): CustomSite[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((x) => {
      const item = x as Partial<CustomSite>;
      const coords = typeof item.id === 'string' ? parseCustomId(item.id) : null;
      if (!coords) return [];
      return [{ id: item.id as string, name: cleanName(String(item.name ?? '')), ...coords }];
    });
  } catch {
    return [];
  }
}

export function saveCustomSites(sites: CustomSite[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
  } catch {
    // Storage full or blocked: the sites last only for this visit.
  }
}
