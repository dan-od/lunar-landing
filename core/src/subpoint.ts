// Where on the Moon a body (Sun or Earth) is directly overhead, derived from its
// azimuth and elevation at any one site. Used to place the Sun and Earth on the
// pole map from real positions. Azimuth is degrees clockwise from north.

const RAD = Math.PI / 180;

export interface SubPoint {
  /** Latitude where the body is overhead, degrees. */
  lat: number;
  /** Longitude (east, 0..360) where the body is overhead, degrees. */
  lon: number;
}

export function subPoint(
  siteLatDeg: number,
  siteLonDeg: number,
  azimuthDeg: number,
  elevationDeg: number,
): SubPoint {
  const phi = siteLatDeg * RAD;
  const h = elevationDeg * RAD;
  const A = azimuthDeg * RAD;

  const sinDec = Math.sin(phi) * Math.sin(h) + Math.cos(phi) * Math.cos(h) * Math.cos(A);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  // Hour angle, positive westward.
  const sinH = (-Math.sin(A) * Math.cos(h)) / Math.cos(dec);
  const cosH = (Math.sin(h) - Math.sin(phi) * sinDec) / (Math.cos(phi) * Math.cos(dec));
  const H = Math.atan2(sinH, cosH) / RAD;

  const lon = (((siteLonDeg - H) % 360) + 360) % 360;
  return { lat: dec / RAD, lon };
}
