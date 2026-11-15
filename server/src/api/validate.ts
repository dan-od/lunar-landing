// Parse and validate query parameters. Each failure names the field and the
// allowed range (7-4). Dates are UTC and limited to 2020-2040 (1-13).
import { badRequest } from './errors.js';

export const DATE_MIN = '2020-01-01';
export const DATE_MAX = '2040-12-31';
export const DATE_RANGE = `${DATE_MIN} to ${DATE_MAX}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown): string | undefined {
  if (Array.isArray(v)) v = v[0];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function parseDate(v: unknown, field = 'date'): string {
  const s = str(v);
  if (!s || !DATE_RE.test(s)) throw badRequest(field, `${field} must be a date YYYY-MM-DD (UTC).`, DATE_RANGE);
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t)) throw badRequest(field, `${field} is not a real date.`, DATE_RANGE);
  if (s < DATE_MIN || s > DATE_MAX) throw badRequest(field, `${field} is outside the allowed range.`, DATE_RANGE);
  return s;
}

export function parseNumber(
  v: unknown,
  field: string,
  min: number,
  max: number,
  fallback?: number,
): number {
  const s = str(v);
  if (s === undefined) {
    if (fallback !== undefined) return fallback;
    throw badRequest(field, `${field} is required.`, `${min} to ${max}`);
  }
  const n = Number(s);
  if (Number.isNaN(n)) throw badRequest(field, `${field} must be a number.`, `${min} to ${max}`);
  if (n < min || n > max) throw badRequest(field, `${field} is out of range.`, `${min} to ${max}`);
  return n;
}

export function parseInteger(
  v: unknown,
  field: string,
  min: number,
  max: number,
  fallback?: number,
): number {
  const n = parseNumber(v, field, min, max, fallback);
  if (!Number.isInteger(n)) throw badRequest(field, `${field} must be a whole number.`, `${min} to ${max}`);
  return n;
}

export interface PlaceQuery {
  site?: string;
  lat?: number;
  lon?: number;
}

/** A place is either a curated site id or a lat/lon pair. */
export function parsePlace(query: Record<string, unknown>): PlaceQuery {
  const site = str(query.site);
  const latRaw = str(query.lat);
  const lonRaw = str(query.lon);
  if (site) return { site };
  if (latRaw !== undefined || lonRaw !== undefined) {
    const lat = parseNumber(latRaw, 'lat', -90, 90);
    const lon = parseNumber(lonRaw, 'lon', -180, 360);
    return { lat, lon };
  }
  throw badRequest('site', 'Give a site id, or a lat and lon.', undefined);
}
