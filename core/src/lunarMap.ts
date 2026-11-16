// The LOLA south pole elevation map's own projection, so the Miss map can say
// where a point is in latitude and longitude, and turn typed coordinates back
// into metres east and north of the target.
//
// The map (LDEM_80S_80MPP_ADJ) is south polar stereographic: lat_0 = -90,
// lat_ts = -90, lon_0 = 0, on a sphere of radius 1,737,400 m (IAU Moon 2015).
// The terrain tool builds its grid the same way: from the target's map position
// it steps along the local east vector (cos L, -sin L) and the local north
// vector (sin L, cos L), with L the target's east longitude (tools/terrain/grid.py).
// Tested against that tool's pyproj values in fixtures/lola-offsets.json.

/** Sphere radius of the elevation map, in metres. */
export const LOLA_RADIUS_M = 1_737_400;

const RAD = Math.PI / 180;

export interface LatLon {
  lat: number;
  /** East longitude, degrees. */
  lon: number;
}

export interface MapXY {
  x: number;
  y: number;
}

/** Latitude and east longitude to map metres (south polar stereographic, scale 1 at the pole). */
export function lolaForward({ lat, lon }: LatLon): MapXY {
  const rho = 2 * LOLA_RADIUS_M * Math.tan(Math.PI / 4 + (lat * RAD) / 2);
  return { x: rho * Math.sin(lon * RAD), y: rho * Math.cos(lon * RAD) };
}

/** Map metres back to latitude and east longitude (0 to 360). */
export function lolaInverse({ x, y }: MapXY): LatLon {
  const rho = Math.hypot(x, y);
  const lat = (2 * Math.atan(rho / (2 * LOLA_RADIUS_M)) - Math.PI / 2) / RAD;
  const lon = rho === 0 ? 0 : Math.atan2(x, y) / RAD;
  return { lat, lon: ((lon % 360) + 360) % 360 };
}

/** The point `east` and `north` metres from the target, as the terrain grid places it. */
export function offsetToLatLon(target: LatLon, east: number, north: number): LatLon {
  const o = lolaForward(target);
  const L = target.lon * RAD;
  return lolaInverse({
    x: o.x + east * Math.cos(L) + north * Math.sin(L),
    y: o.y - east * Math.sin(L) + north * Math.cos(L),
  });
}

/** Metres east and north of the target, on the terrain grid, of a latitude and longitude. */
export function latLonToOffset(target: LatLon, point: LatLon): { east: number; north: number } {
  const o = lolaForward(target);
  const p = lolaForward(point);
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  const L = target.lon * RAD;
  return { east: dx * Math.cos(L) - dy * Math.sin(L), north: dx * Math.sin(L) + dy * Math.cos(L) };
}

/** "84.7839 S, 29.1445 E": degrees to four decimals, N or S, east longitude 0 to 360. */
export function latLonText(lat: number, lon: number): string {
  const east = ((lon % 360) + 360) % 360;
  const latText = Math.abs(lat).toFixed(4);
  const ns = Number(latText) === 0 ? '' : lat < 0 ? ' S' : ' N';
  return `${latText}${ns}, ${(Number(east.toFixed(4)) % 360).toFixed(4)} E`;
}

/** Signed degrees for copying: "-84.7839, 29.1445" (latitude, east longitude), four decimals. */
export function latLonPlain(lat: number, lon: number): string {
  const east = ((lon % 360) + 360) % 360;
  return `${lat.toFixed(4)}, ${(Number(east.toFixed(4)) % 360).toFixed(4)}`;
}
