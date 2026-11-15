// Pure derivations for the Console. Every number shown comes from the hourly NASA
// series through the one shared calculator in @moon/core, so the pages, the API
// and exported files cannot disagree.
import {
  computeResult,
  stateForThresholds,
  subPoint,
  thresholdFor,
  type PositionRow,
  type SiteState,
  type WindowResult,
} from '@moon/core';
import type { SeriesPoint } from './api';

export const DISPLAY_DAYS = 30;
export const DISPLAY_HOURS = DISPLAY_DAYS * 24;

/** Sun and Earth rows from the landing moment onward (up to 30 days + 1 hour). */
export interface SiteSeries {
  sun: PositionRow[];
  earth: PositionRow[];
  /**
   * Terrain horizon for this point (360 heights, index = degrees clockwise from
   * north). When present it replaces the shadow allowance: the terrain model.
   */
  horizon?: number[];
}

/**
 * Cut the fetched hourly points so index 0 is the landing moment.
 * `points` starts at 00:00 UTC on the landing date.
 */
export function toSeries(points: SeriesPoint[], date: string, hour: number, horizon?: number[]): SiteSeries {
  const landing = `${date}T${String(hour).padStart(2, '0')}:00:00Z`;
  const from = points.findIndex((p) => p.t === landing);
  const cut = from < 0 ? [] : points.slice(from, from + DISPLAY_HOURS + 1);
  const usable = cut.filter((p) => p.earth_elev !== null && p.earth_az !== null);
  return {
    sun: usable.map((p) => ({ body: 'sun', time: p.t, azimuthDeg: p.sun_az, elevationDeg: p.sun_elev })),
    earth: usable.map((p) => ({
      body: 'earth',
      time: p.t,
      azimuthDeg: p.earth_az as number,
      elevationDeg: p.earth_elev as number,
    })),
    ...(horizon ? { horizon } : {}),
  };
}

/** The 30-day result for a site at a shadow allowance. */
export function resultFor(series: SiteSeries, marginDeg: number): WindowResult {
  return computeResult(series.sun.slice(0, DISPLAY_HOURS), series.earth.slice(0, DISPLAY_HOURS), {
    marginDeg,
    horizon: series.horizon,
  });
}

/** Row index for a marker position in days after landing. */
export function indexAt(tDays: number): number {
  return Math.round(tDays * 24);
}

export interface Readout {
  time: string;
  sunElev: number;
  sunAz: number;
  earthElev: number;
  earthAz: number;
  /** What each body has to clear at this moment: the allowance, or the terrain in its direction. */
  sunThreshold: number;
  earthThreshold: number;
  state: SiteState;
}

/** What the inspector shows at the marker; undefined when no data is saved for that hour. */
export function readoutAt(series: SiteSeries, marginDeg: number, tDays: number): Readout | undefined {
  const i = indexAt(tDays);
  const s = series.sun[i];
  const e = series.earth[i];
  if (!s || !e) return undefined;
  const sunThreshold = thresholdFor(s, marginDeg, series.horizon);
  const earthThreshold = thresholdFor(e, marginDeg, series.horizon);
  return {
    time: s.time,
    sunElev: s.elevationDeg,
    sunAz: s.azimuthDeg,
    earthElev: e.elevationDeg,
    earthAz: e.azimuthDeg,
    sunThreshold,
    earthThreshold,
    state: stateForThresholds(s.elevationDeg, e.elevationDeg, sunThreshold, earthThreshold),
  };
}

/** Longitudes (east) where the Sun and Earth are overhead, for the pole map. */
export function overheadLongitudes(siteLat: number, siteLon: number, r: Readout): { sun: number; earth: number } {
  return {
    sun: subPoint(siteLat, siteLon, r.sunAz, r.sunElev).lon,
    earth: subPoint(siteLat, siteLon, r.earthAz, r.earthElev).lon,
  };
}

/** "+1.7°" style. */
export function fmtDeg(v: number): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}°`;
}

/** Hours to a short duration: "7 h" under a day, otherwise "1.5 d". */
export function fmtDuration(hours: number): string {
  return hours < 24 ? `${hours} h` : `${(hours / 24).toFixed(1)} d`;
}

/** Vertical scale for the sky view: tight for polar sites, full for the rest. */
export function skyScale(sunElev: number, earthElev: number): { lo: number; hi: number } {
  const top = Math.max(sunElev, earthElev);
  return { lo: -10, hi: top <= 12 ? 15 : 90 };
}

/** Fraction (0 at the top, 1 at the bottom) for an elevation on the sky view. */
export function skyFraction(elev: number, scale: { lo: number; hi: number }): number {
  const clamped = Math.min(scale.hi, Math.max(scale.lo, elev));
  return (scale.hi - clamped) / (scale.hi - scale.lo);
}
