// Direction helpers. The whole app uses degrees clockwise from north (0..360),
// the same convention NASA Horizons azimuth and terrain profiles use (see F-6).

/** Fold any angle in degrees into the range [0, 360). */
export function normalizeAzimuth(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Normalise a longitude to degrees east in [0, 360). */
export function toEastLongitude(lon: number): number {
  return normalizeAzimuth(lon);
}

/** Clamp the shadow allowance to its locked range (0..5 degrees). */
export function clampMargin(deg: number): number {
  return Math.min(5, Math.max(0, deg));
}
