import type { SiteState, WindowResult } from '@moon/core';
import type { ApiSite } from '../api';
import type { Readout, SiteSeries } from '../siteData';

/** Everything the Console shows for one site. Fields are absent when no data is saved. */
export interface SiteRow {
  site: ApiSite;
  short: string;
  series?: SiteSeries;
  /** 30-day result at the current shadow allowance. */
  result?: WindowResult;
  /** State at the landing moment. */
  landing?: SiteState;
  /** Readout at the time marker. */
  now?: Readout;
}

/** Symbol and word shown when a site has no saved positions. */
export const NO_DATA = { symbol: '–', word: 'NO DATA' };
