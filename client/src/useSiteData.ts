// Loads the hourly series for every site for the current landing date. If the
// server or NASA is unavailable it falls back to the results saved earlier in
// this browser, and never invents data.
import { useCallback, useEffect, useState } from 'react';
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

  // The aim point is fetched from its base site with its offset, so its place in
  // the key carries the offset too.
  const ids = sites
    .map((s) => (s.aim ? `${s.id}@${s.aim.base}:${s.aim.east}:${s.aim.north}` : s.id))
    .join(',');
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
        siteIds.map(async (entry) => {
          const [id = entry, aimPart] = entry.split('@');
          const [base, east, north] = (aimPart ?? '').split(':');
          const aim = aimPart ? { east: Number(east), north: Number(north) } : undefined;
          const savedKey = `${date}T${hour}${aimPart ? `@${aimPart}` : ''}`;
          let points: SeriesPoint[] | undefined;
          let horizon: number[] | undefined;
          try {
            if (force === 'down') throw new ApiFailure('unavailable', 'NASA’s position service is not answering.');
            const reply = await getWindows(aim ? base! : id, date, hour, DISPLAY_DAYS, controller.signal, aim);
            points = reply.series;
            horizon = reply.horizon;
            if (reply.partial) partial = true;
            writeSaved(id, savedKey, points, horizon);
          } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            failure = err instanceof ApiFailure ? err : new ApiFailure('network', 'The request failed.');
            const saved = readSaved(id, savedKey);
            points = saved?.points;
            horizon = saved?.horizon;
          }
          // An aim point without its terrain horizon is never shown on the smooth model.
          if (!points || (aim && !horizon)) return;
          const series = toSeries(points, date, hour, horizon);
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
