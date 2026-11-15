// Loads one side of Compare: the hourly series for a place from its landing
// moment. Real positions only; a failed request is reported, never filled in.
import { useEffect, useState } from 'react';
import { ApiFailure, getWindows, type AimOffset } from '../api';
import { DISPLAY_DAYS, toSeries, type SiteSeries } from '../siteData';
import type { CompareSide } from '../scenario';

export interface CaseData {
  series?: SiteSeries;
  loading: boolean;
  failure: ApiFailure | null;
}

/** Where a side's positions come from: a site, or an aim point on a site's prepared terrain. */
export interface CaseSource {
  site: string;
  aim?: AimOffset;
}

export function useCase(side: CompareSide, source: CaseSource, enabled: boolean): CaseData {
  const aimKey = source.aim ? `${source.aim.east}:${source.aim.north}` : '';
  const key = `${source.site}|${aimKey}|${side.date}|${side.hour}`;
  const [state, setState] = useState<{ key: string; series?: SiteSeries; failure: ApiFailure | null }>({
    key: '',
    failure: null,
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const aim = aimKey ? source.aim : undefined;
    getWindows(source.site, side.date, side.hour, DISPLAY_DAYS, controller.signal, aim)
      .then((reply) => {
        // An aim point is only ever shown on its terrain horizon.
        if (aim && !reply.horizon) throw new ApiFailure('no-terrain', 'No terrain horizon came back for the aim point.');
        const series = toSeries(reply.series, side.date, side.hour, reply.horizon);
        setState({ key, series: series.sun.length > 0 ? series : undefined, failure: null });
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setState({
          key,
          failure: err instanceof ApiFailure ? err : new ApiFailure('network', 'The request failed.'),
        });
      });
    return () => controller.abort();
    // `key` stands for the source, aim, date and hour.
  }, [key, enabled, source.site, aimKey, side.date, side.hour]); // source.aim is covered by aimKey

  const current = state.key === key;
  return {
    series: current ? state.series : undefined,
    loading: enabled && !current,
    failure: current ? state.failure : null,
  };
}
