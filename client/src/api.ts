// Calls to the server's v1 API. The browser never talks to NASA.
import { parseCustomId } from './customSites';

export interface ApiSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  source: string;
  has_terrain: boolean;
  /** Set on the aim point carried from the Miss tab: the site it belongs to and its offset. */
  aim?: { base: string; east: number; north: number };
  /** True for coordinates the visitor added themselves. */
  custom?: boolean;
}

export interface SeriesPoint {
  t: string;
  sun_elev: number;
  sun_az: number;
  earth_elev: number | null;
  earth_az: number | null;
}

export interface WindowsReply {
  model: string;
  saved: boolean;
  partial: boolean;
  series: SeriesPoint[];
  /** Terrain horizon (360 heights) when the reply is for an aim point. */
  horizon?: number[];
}

export interface MissReply {
  model: string;
  saved: boolean;
  grid: {
    step_m: number;
    half_m: number;
    /** [metres east, metres north, 1 if a landing there works] */
    points: Array<[number, number, number]>;
  };
}

export type FailureKind = 'unavailable' | 'rate' | 'bad' | 'network' | 'no-terrain';

export class ApiFailure extends Error {
  constructor(
    public readonly kind: FailureKind,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiFailure('network', 'The Moon Status server could not be reached.');
  }
  if (res.ok) return (await res.json()) as T;

  let message = `Request failed (HTTP ${res.status}).`;
  let retryAfter: number | undefined;
  try {
    const body = (await res.json()) as { error?: { message?: string; retryAfterSeconds?: number } };
    if (body.error?.message) message = body.error.message;
    retryAfter = body.error?.retryAfterSeconds;
  } catch {
    // Not JSON (for example a proxy error page): keep the generic message.
  }
  if (res.status === 429) throw new ApiFailure('rate', message, retryAfter);
  if (res.status === 409) throw new ApiFailure('no-terrain', message);
  if (res.status >= 500) throw new ApiFailure('unavailable', message);
  throw new ApiFailure('bad', message);
}

export async function getSites(signal?: AbortSignal): Promise<ApiSite[]> {
  const body = await getJson<{ sites: ApiSite[] }>('/v1/sites', signal);
  return body.sites;
}

export interface AimOffset {
  east: number;
  north: number;
}

/**
 * Put a place into a query: a listed site by its id, or a custom point by its
 * coordinates (which its id carries). `prefix` selects one side of /v1/report.
 */
export function setPlace(q: URLSearchParams, siteId: string, prefix = ''): void {
  const point = parseCustomId(siteId);
  if (point) {
    q.set(`${prefix}lat`, String(point.lat));
    q.set(`${prefix}lon`, String(point.lon));
  } else {
    q.set(`${prefix}site`, siteId);
  }
}

function windowsQuery(site: string, start: string, hour: number, days: number, aim?: AimOffset): URLSearchParams {
  const q = new URLSearchParams();
  setPlace(q, site);
  q.set('start', start);
  q.set('hour', String(hour));
  q.set('days', String(days));
  if (aim) {
    q.set('aim_east', String(aim.east));
    q.set('aim_north', String(aim.north));
  }
  return q;
}

/** Windows for a site; with `aim`, for that aim point on the site's prepared terrain. */
export function getWindows(
  site: string,
  start: string,
  hour: number,
  days: number,
  signal?: AbortSignal,
  aim?: AimOffset,
): Promise<WindowsReply> {
  return getJson<WindowsReply>(`/v1/windows?${windowsQuery(site, start, hour, days, aim).toString()}`, signal);
}

/** Address of the spreadsheet file for one site's windows (6-1). */
export function windowsCsvUrl(
  site: string,
  start: string,
  hour: number,
  days: number,
  margin: number,
  aim?: AimOffset,
): string {
  const q = windowsQuery(site, start, hour, days, aim);
  q.set('margin', String(margin));
  return `/v1/windows.csv?${q.toString()}`;
}

/** The prepared terrain grid for a site and landing moment: which points work. */
export function getMiss(site: string, date: string, hour: number, signal?: AbortSignal): Promise<MissReply> {
  const q = new URLSearchParams({ site, date, hour: String(hour) });
  return getJson<MissReply>(`/v1/miss?${q.toString()}`, signal);
}
