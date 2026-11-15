// Loads the hourly series for every site for the current landing date. If the
// server or NASA is unavailable it falls back to the results saved earlier in
// this browser, and never invents data.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiFailure, getWindows, type ApiSite, type SeriesPoint } from './api';
import { DISPLAY_DAYS, toSeries, type SiteSeries } from './siteData';
import type { ForceState } from './state';

export const MAX_RETRIES = 3;

interface Saved {
  /** Landing moment the points start at, e.g. "2025-03-06T00". */
  date: string;
  points: SeriesPoint[];
  horizon?: number[];
}

const key = (siteId: string) => `moon:series:${siteId}`;

function readSaved(siteId: string, date: string): Saved | undefined {
  try {
    const raw = window.localStorage.getItem(key(siteId));
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as Saved;
    return saved.date === date ? saved : undefined;
  } catch {
    return undefined;
  }
}

function writeSaved(siteId: string, date: string, points: SeriesPoint[], horizon?: number[]): void {
  try {
    window.localStorage.setItem(key(siteId), JSON.stringify({ date, points, horizon } satisfies Saved));
  } catch {
    // Storage full or blocked: results are simply not saved.
  }
}

export interface SiteData {
  /** Series per site id; a site with nothing loaded or saved is absent. */
  data: Record<string, SiteSeries>;
  /** True until the first site of the current date and hour has answered. */
  loading: boolean;
  /** Sites still waiting for their positions (a newly added site shows "fetching"). */
  fetching: Set<string>;
  /** Set when a request failed; saved results are shown where they exist. */
  failure: ApiFailure | null;
  /** Per-site failures, for example a new site refused by the hourly limit. */
  failures: Record<string, ApiFailure>;
  /** True when some of the 30 days could not be fetched. */
  partial: boolean;
  retries: number;
  retry: () => void;
}

interface Entry {
  /** Which request this answers: site entry, date, hour and retry count. */
  key: string;
  series?: SiteSeries;
  failure?: ApiFailure;
  partial: boolean;
}

/** One site's positions, from the server or, failing that, from this browser's saved copy. */
async function loadOne(
  entry: string,
  date: string,
  hour: number,
  force: ForceState,
  signal: AbortSignal,
): Promise<Omit<Entry, 'key'>> {
  const [id = entry, aimPart] = entry.split('@');
  const [base, east, north] = (aimPart ?? '').split(':');
  const aim = aimPart ? { east: Number(east), north: Number(north) } : undefined;
  const savedKey = `${date}T${hour}${aimPart ? `@${aimPart}` : ''}`;
  let points: SeriesPoint[] | undefined;
  let horizon: number[] | undefined;
  let failure: ApiFailure | undefined;
  let partial = false;
  try {
    if (force === 'down') throw new ApiFailure('unavailable', 'NASA’s position service is not answering.');
    const reply = await getWindows(aim ? base! : id, date, hour, DISPLAY_DAYS, signal, aim);
    points = reply.series;
    horizon = reply.horizon;
    partial = reply.partial;
    writeSaved(id, savedKey, points, horizon);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    failure = err instanceof ApiFailure ? err : new ApiFailure('network', 'The request failed.');
    const saved = readSaved(id, savedKey);
    points = saved?.points;
    horizon = saved?.horizon;
  }
  // An aim point without its terrain horizon is never shown on the smooth model.
  if (!points || (aim && !horizon)) return { failure, partial };
  const series = toSeries(points, date, hour, horizon);
  return { series: series.sun.length > 0 ? series : undefined, failure, partial };
}

export function useSiteData(sites: ApiSite[], date: string, hour: number, force: ForceState): SiteData {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [retries, setRetries] = useState(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // The aim point is fetched from its base site with its offset, so its place in
  // the key carries the offset too.
  const list = sites.map((s) => ({
    id: s.id,
    entry: s.aim ? `${s.id}@${s.aim.base}:${s.aim.east}:${s.aim.north}` : s.id,
  }));
  const ids = list.map((x) => x.entry).join('\n');
  const keyOf = (entry: string) => `${entry}|${date}|${hour}|${retries}|${force ?? ''}`;

  useEffect(() => {
    if (!ids || force === 'loading') return;
    const controller = new AbortController();
    for (const entry of ids.split('\n')) {
      const key = `${entry}|${date}|${hour}|${retries}|${force ?? ''}`;
      const id = entry.split('@')[0]!;
      // Each site loads on its own; one already answered for this moment is kept.
      if (entriesRef.current[id]?.key === key) continue;
      loadOne(entry, date, hour, force, controller.signal)
        .then((result) => {
          setEntries((prev) => ({ ...prev, [id]: { key, ...result } }));
        })
        .catch(() => {
          // Aborted: a newer request for this site replaces it.
        });
    }
    return () => controller.abort();
  }, [ids, date, hour, force, retries]);

  const retry = useCallback(() => setRetries((r) => r + 1), []);

  const data: Record<string, SiteSeries> = {};
  const failures: Record<string, ApiFailure> = {};
  const fetching = new Set<string>();
  let failure: ApiFailure | null = null;
  let partial = false;
  let answered = 0;
  for (const { id, entry } of list) {
    const e = entries[id];
    if (!e || e.key !== keyOf(entry)) {
      fetching.add(id);
      continue;
    }
    answered++;
    if (e.series) data[id] = e.series;
    if (e.partial) partial = true;
    if (e.failure) {
      failures[id] = e.failure;
      // A refused new site is that site's problem, not an outage.
      if (e.failure.kind !== 'rate' && e.failure.kind !== 'bad' && !failure) failure = e.failure;
    }
  }

  return {
    data,
    loading: force === 'loading' || (list.length > 0 && answered === 0),
    fetching,
    failure,
    failures,
    partial,
    retries,
    retry,
  };
}
