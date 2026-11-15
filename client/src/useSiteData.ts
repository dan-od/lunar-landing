// Loads the hourly series for every site for the current landing date. If the
// server or NASA is unavailable it falls back to the results saved earlier in
// this browser, and never invents data.
import { useCallback, useEffect, useState } from 'react';
import { ApiFailure, getWindows, type ApiSite, type SeriesPoint } from './api';
import { toSeries, type SiteSeries } from './siteData';
import type { ForceState } from './state';

/** 30 days from a 00:00 landing; one more day when the landing hour is later. */
const fetchDays = (hour: number) => (hour === 0 ? 30 : 31);
export const MAX_RETRIES = 3;

interface Saved {
  date: string;
  points: SeriesPoint[];
}

const key = (siteId: string) => `moon:series:${siteId}`;

function readSaved(siteId: string, date: string): SeriesPoint[] | undefined {
  try {
    const raw = window.localStorage.getItem(key(siteId));
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as Saved;
    return saved.date === date ? saved.points : undefined;
  } catch {
    return undefined;
  }
}

function writeSaved(siteId: string, date: string, points: SeriesPoint[]): void {
  try {
    window.localStorage.setItem(key(siteId), JSON.stringify({ date, points } satisfies Saved));
  } catch {
    // Storage full or blocked: results are simply not saved.
  }
}

export interface SiteData {
  /** Series per site id; a site with nothing loaded or saved is absent. */
  data: Record<string, SiteSeries>;
  loading: boolean;
  /** Set when a request failed; saved results are shown where they exist. */
  failure: ApiFailure | null;
  /** True when some of the 30 days could not be fetched. */
  partial: boolean;
  retries: number;
  retry: () => void;
}

export function useSiteData(sites: ApiSite[], date: string, hour: number, force: ForceState): SiteData {
  const [state, setState] = useState<{ loadKey: string; data: Record<string, SiteSeries>; failure: ApiFailure | null; partial: boolean }>({
    loadKey: '',
    data: {},
    failure: null,
    partial: false,
  });
  const [retries, setRetries] = useState(0);

  const ids = sites.map((s) => s.id).join(',');
  const loadKey = `${ids}|${date}|${hour}`;

  useEffect(() => {
    if (!ids || force === 'loading') return;
    const siteIds = ids.split(',');
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      const data: Record<string, SiteSeries> = {};
      let failure: ApiFailure | null = null;
      let partial = false;

      await Promise.all(
        siteIds.map(async (id) => {
          let points: SeriesPoint[] | undefined;
          try {
            if (force === 'down') throw new ApiFailure('unavailable', 'NASA’s position service is not answering.');
            const reply = await getWindows(id, date, fetchDays(hour), controller.signal);
            points = reply.series;
            if (reply.partial) partial = true;
            writeSaved(id, date, points);
          } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            failure = err instanceof ApiFailure ? err : new ApiFailure('network', 'The request failed.');
            points = readSaved(id, date);
          }
          if (!points) return;
          const series = toSeries(points, date, hour);
          if (series.sun.length > 0) data[id] = series;
        }),
      );

      if (!cancelled) setState({ loadKey, data, failure, partial });
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `retries` re-runs the load when Retry is pressed.
  }, [ids, date, hour, force, loadKey, retries]);

  const retry = useCallback(() => setRetries((r) => r + 1), []);

  const current = state.loadKey === loadKey;
  return {
    data: current ? state.data : {},
    loading: force === 'loading' || (ids !== '' && !current),
    failure: current ? state.failure : null,
    partial: current ? state.partial : false,
    retries,
    retry,
  };
}
