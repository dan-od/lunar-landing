// Loads one side of Compare: the hourly series for a place from its landing
// moment. Real positions only; a failed request is reported, never filled in.
import { useEffect, useState } from 'react';
import { ApiFailure, getWindows } from '../api';
import { DISPLAY_DAYS, toSeries, type SiteSeries } from '../siteData';
import type { CompareSide } from '../scenario';

export interface CaseData {
  series?: SiteSeries;
  loading: boolean;
  failure: ApiFailure | null;
}

export function useCase(side: CompareSide, enabled: boolean): CaseData {
  const key = `${side.site}|${side.date}|${side.hour}`;
  const [state, setState] = useState<{ key: string; series?: SiteSeries; failure: ApiFailure | null }>({
    key: '',
    failure: null,
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getWindows(side.site, side.date, side.hour, DISPLAY_DAYS, controller.signal)
      .then((reply) => {
        const series = toSeries(reply.series, side.date, side.hour);
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
    // `key` stands for the three side fields.
  }, [key, enabled, side.site, side.date, side.hour]);

  const current = state.key === key;
  return {
    series: current ? state.series : undefined,
    loading: enabled && !current,
    failure: current ? state.failure : null,
  };
}
