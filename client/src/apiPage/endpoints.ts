// The public endpoints, each with the request it makes for the current scenario.
// The API tab shows these and sends them for real; the pages use the same ones.
import { AIM_SITE_ID, slipDate, type Scenario } from '../scenario';

export interface EndpointDef {
  key: string;
  method: 'GET';
  path: string;
  summary: string;
  /** What the reply is, in a line. */
  returns: string;
  /** True when the reply is a file rather than JSON. */
  file?: boolean;
}

export const ENDPOINTS: EndpointDef[] = [
  {
    key: 'sites',
    method: 'GET',
    path: '/v1/sites',
    summary: 'The landing sites',
    returns: 'Each site with its coordinates, the source of those coordinates, and whether terrain is prepared.',
  },
  {
    key: 'sky',
    method: 'GET',
    path: '/v1/sky',
    summary: 'Sun and Earth at one place and time',
    returns: 'Direction and height of the Sun and Earth for one hour, and the state word.',
  },
  {
    key: 'windows',
    method: 'GET',
    path: '/v1/windows',
    summary: 'Power and contact windows',
    returns: 'Windows, uptime, longest gap and next change over a span, with the hourly positions.',
  },
  {
    key: 'csv',
    method: 'GET',
    path: '/v1/windows.csv',
    summary: 'The same windows as a spreadsheet file',
    returns: 'One row per window, with the scenario and the model in the first lines.',
    file: true,
  },
  {
    key: 'report',
    method: 'GET',
    path: '/v1/report',
    summary: 'Change report between two cases',
    returns: 'A verdict and five sentences, each marked better, worse or same.',
  },
  {
    key: 'slip',
    method: 'GET',
    path: '/v1/slip',
    summary: 'Ready or not for each day the landing slips',
    returns: 'The state at the landing hour for every whole-day slip from 30 days earlier to 30 days later.',
  },
  {
    key: 'miss',
    method: 'GET',
    path: '/v1/miss',
    summary: 'What if the landing misses?',
    returns: 'Landings out of 10 that would work at 100, 250 and 320 m, and the safest aim. Terrain model.',
  },
];

/**
 * The request each endpoint makes for a scenario. `terrainSiteId` is the site
 * with prepared terrain; the aim point is sent as that site plus its offset.
 */
export function endpointUrl(key: string, s: Scenario, terrainSiteId: string | undefined): string {
  const onAim = s.site === AIM_SITE_ID && terrainSiteId !== undefined;
  const site = onAim ? terrainSiteId : s.site;
  const q = new URLSearchParams();
  const aim = () => {
    if (onAim) {
      q.set('aim_east', String(s.aim.east));
      q.set('aim_north', String(s.aim.north));
    }
  };

  switch (key) {
    case 'sites':
      return '/v1/sites';
    case 'sky':
      q.set('site', site);
      q.set('date', s.date);
      q.set('hour', String(s.hour));
      q.set('margin', String(s.margin));
      return `/v1/sky?${q.toString()}`;
    case 'windows':
    case 'csv':
      q.set('site', site);
      q.set('start', s.date);
      q.set('hour', String(s.hour));
      q.set('days', '30');
      q.set('margin', String(s.margin));
      aim();
      return `/v1/windows${key === 'csv' ? '.csv' : ''}?${q.toString()}`;
    case 'report':
      // The same place, ten days later: the Compare tab's first quick setup.
      q.set('a_site', site);
      q.set('a_date', s.date);
      q.set('a_hour', String(s.hour));
      q.set('b_site', site);
      q.set('b_date', slipDate(s.date, 10));
      q.set('b_hour', String(s.hour));
      q.set('margin', String(s.margin));
      return `/v1/report?${q.toString()}`;
    case 'slip':
      q.set('site', site);
      q.set('date', s.date);
      q.set('hour', String(s.hour));
      q.set('margin', String(s.margin));
      return `/v1/slip?${q.toString()}`;
    case 'miss':
      q.set('site', terrainSiteId ?? site);
      q.set('date', s.date);
      q.set('hour', String(s.hour));
      q.set('east', String(s.aim.east));
      q.set('north', String(s.aim.north));
      q.set('accuracy', String(s.accuracy));
      return `/v1/miss?${q.toString()}`;
    default:
      return '/v1/sites';
  }
}

/**
 * JSON for reading on screen: long lists are cut to their first few entries
 * with a line saying how many were left out. Nothing else is changed.
 */
export function previewJson(value: unknown, keep = 3): string {
  const trim = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const flat = v.every((x) => typeof x === 'number');
      const limit = flat ? 8 : keep;
      const head = v.slice(0, limit).map(trim);
      return v.length > limit ? [...head, `… ${v.length - limit} more`] : head;
    }
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, trim(x)]));
    }
    return v;
  };
  return JSON.stringify(trim(value), null, 2);
}
