// NASA Horizons client. Server-side only, called one request at a time through
// the queue, and every reply is cached (AGENTS.md data rules).
import type { Body, PositionRow, Site } from '@moon/core';
import { toEastLongitude } from '@moon/core';
import { config } from '../config.js';
import { parseHorizons } from './parse.js';

/** COMMAND ids: Sun = 10, Earth = 399. */
const COMMAND: Record<Body, string> = { sun: '10', earth: '399' };

export interface HorizonsSpan {
  /** Inclusive UTC start, e.g. '2025-03-06 00:00'. */
  start: string;
  /** Inclusive UTC stop. */
  stop: string;
  /** Step string Horizons honours, e.g. '1h'. */
  step: string;
}

/** Build the Horizons API URL for a site and body. */
export function buildHorizonsUrl(site: Site, body: Body, span: HorizonsSpan): string {
  const siteCoord = `${toEastLongitude(site.lon)},${site.lat},${site.heightKm}`;
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${COMMAND[body]}'`,
    EPHEM_TYPE: 'OBSERVER',
    CENTER: "'coord@301'",
    COORD_TYPE: 'GEODETIC',
    SITE_COORD: `'${siteCoord}'`,
    START_TIME: `'${span.start}'`,
    STOP_TIME: `'${span.stop}'`,
    STEP_SIZE: `'${span.step}'`,
    QUANTITIES: "'4'",
  });
  return `${config.horizonsApiUrl}?${params.toString()}`;
}

/** Fetch and parse one body's series for a site. Network call — never in tests. */
export async function fetchHorizons(
  site: Site,
  body: Body,
  span: HorizonsSpan,
): Promise<PositionRow[]> {
  const url = buildHorizonsUrl(site, body, span);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Horizons request failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  return parseHorizons(text, body);
}
