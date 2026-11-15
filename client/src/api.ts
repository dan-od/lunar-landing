// Calls to the server's v1 API. The browser never talks to NASA.

export interface ApiSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  source: string;
  has_terrain: boolean;
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
}

export type FailureKind = 'unavailable' | 'rate' | 'bad' | 'network';

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
  if (res.status >= 500) throw new ApiFailure('unavailable', message);
  throw new ApiFailure('bad', message);
}

export async function getSites(signal?: AbortSignal): Promise<ApiSite[]> {
  const body = await getJson<{ sites: ApiSite[] }>('/v1/sites', signal);
  return body.sites;
}

export function getWindows(site: string, start: string, days: number, signal?: AbortSignal): Promise<WindowsReply> {
  const q = new URLSearchParams({ site, start, days: String(days) });
  return getJson<WindowsReply>(`/v1/windows?${q.toString()}`, signal);
}
