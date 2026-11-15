"""Shared terrain library for Moon Status.

Reads the south-pole elevation map and turns a lunar point into a horizon
profile: 360 directions, degrees clockwise from north, with each direction's
highest terrain angle seen by a 2 m-tall observer looking out to 150 km,
corrected for the Moon's curvature.

Nothing is invented. Elevations come from the GeoTIFF by bilinear
interpolation; outside the map, or on nodata, a sample is NaN and does not
count, and the distance at which a ray left the map is recorded.

Conventions (all verified against the file's own projection in
direction_check.py, not assumed):
  * Projection: south polar stereographic, lat_of_origin -90, central
    meridian 0, on the IAU Moon 2015 sphere (R = 1_737_400 m).
  * At longitude L the map vector of local north is (sin L, cos L) and of
    local east is (cos L, -sin L), with +x = easting, +y = northing.
  * Azimuth A is degrees clockwise from north toward east, so the map step
    direction is (sin(L + A), cos(L + A)). This is the same convention the
    NASA Horizons fixtures state in their header.
"""
from __future__ import annotations

import numpy as np
import rasterio
from pyproj import CRS, Transformer

DEFAULT_DEM = "../../data/LDEM_80S_80MPP_ADJ.TIF"

OBSERVER_HEIGHT_M = 2.0      # lander eye height above the surface
MAX_RANGE_M = 150_000.0      # walk out to 150 km where the map allows
N_AZIMUTHS = 360             # one ray per whole degree
STEP_BASE_M = 40.0           # near-field step, matches the grid spacing
STEP_GROWTH = 0.03           # step grows to 3% of distance far out


class Terrain:
    def __init__(self, dem_path: str = DEFAULT_DEM):
        self.path = dem_path
        with rasterio.open(dem_path) as ds:
            self.width = ds.width
            self.height = ds.height
            self.transform = ds.transform
            self.crs = CRS.from_user_input(ds.crs)
            self.nodata = ds.nodata
            self.scale = ds.scales[0]
            self.offset = ds.offsets[0]
            self.elev = ds.read(1).astype(np.float64)
        # nodata -> NaN so it never counts
        if self.nodata is not None and not np.isnan(self.nodata):
            self.elev[self.elev == self.nodata] = np.nan
        self.elev = self.elev * self.scale + self.offset

        # Moon radius from the file's own ellipsoid, not a hard-coded guess.
        self.radius_m = self.crs.ellipsoid.semi_major_metre

        # affine transform terms: x = a*col + c, y = e*row + f
        self.a = self.transform.a
        self.c = self.transform.c
        self.e = self.transform.e
        self.f = self.transform.f

        geog = self.crs.geodetic_crs
        self._fwd = Transformer.from_crs(geog, self.crs, always_xy=True)
        self._inv = Transformer.from_crs(self.crs, geog, always_xy=True)

    # --- coordinate helpers -------------------------------------------------
    def lonlat_to_xy(self, lon, lat):
        return self._fwd.transform(lon, lat)

    def xy_to_lonlat(self, x, y):
        return self._inv.transform(x, y)

    def xy_to_pixel(self, x, y):
        """Fractional (col, row) with integers at pixel centres."""
        col = (np.asarray(x) - self.c) / self.a - 0.5
        row = (np.asarray(y) - self.f) / self.e - 0.5
        return col, row

    def pixel_to_xy(self, col, row):
        x = self.a * (np.asarray(col) + 0.5) + self.c
        y = self.e * (np.asarray(row) + 0.5) + self.f
        return x, y

    # --- sampling -----------------------------------------------------------
    def sample_bilinear(self, x, y):
        """Bilinear elevation (m) at projected x, y. NaN off-map or on nodata.

        Bilinear because the 40 m grid is finer than the 80 m pixels.
        """
        col, row = self.xy_to_pixel(x, y)
        col = np.asarray(col, dtype=np.float64)
        row = np.asarray(row, dtype=np.float64)

        c0 = np.floor(col).astype(np.int64)
        r0 = np.floor(row).astype(np.int64)
        c1 = c0 + 1
        r1 = r0 + 1
        fc = col - c0
        fr = row - r0

        in_bounds = (c0 >= 0) & (r0 >= 0) & (c1 < self.width) & (r1 < self.height)

        cc0 = np.clip(c0, 0, self.width - 1)
        cc1 = np.clip(c1, 0, self.width - 1)
        rr0 = np.clip(r0, 0, self.height - 1)
        rr1 = np.clip(r1, 0, self.height - 1)

        v00 = self.elev[rr0, cc0]
        v01 = self.elev[rr0, cc1]
        v10 = self.elev[rr1, cc0]
        v11 = self.elev[rr1, cc1]

        top = v00 * (1 - fc) + v01 * fc
        bot = v10 * (1 - fc) + v11 * fc
        out = top * (1 - fr) + bot * fr
        out = np.where(in_bounds, out, np.nan)
        return out

    # --- direction vectors --------------------------------------------------
    @staticmethod
    def north_east_map(lon_deg):
        """Unit map vectors (east=+x, north=+y) of local north and east."""
        L = np.radians(lon_deg)
        north = np.array([np.sin(L), np.cos(L)])
        east = np.array([np.cos(L), -np.sin(L)])
        return north, east

    @staticmethod
    def _distances():
        d = []
        dist = STEP_BASE_M
        while dist < MAX_RANGE_M:
            d.append(dist)
            dist += max(STEP_BASE_M, dist * STEP_GROWTH)
        d.append(MAX_RANGE_M)      # exact endpoint, so a full ray reads 150 km
        return np.array(d)

    # --- horizon ------------------------------------------------------------
    def horizon_profile(self, lat_deg, lon_deg):
        """Return (horizon, reach) each length 360.

        horizon[a] = highest terrain angle (deg) in azimuth a (clockwise from
        north). reach[a] = metres the ray stayed on the map (<= 150 km).
        """
        ox, oy = self.lonlat_to_xy(lon_deg, lat_deg)
        obs_surf = float(self.sample_bilinear(ox, oy))
        if not np.isfinite(obs_surf):
            raise ValueError("observer point has no elevation (off-map/nodata)")
        obs_elev = obs_surf + OBSERVER_HEIGHT_M

        az = np.arange(N_AZIMUTHS)                      # (A,)
        dists = self._distances()                       # (M,)
        # map step direction for azimuth a at this longitude: (sin(L+a), cos(L+a))
        ang = np.radians(lon_deg + az)                  # (A,)
        ux = np.sin(ang)[:, None]                       # (A,1)
        uy = np.cos(ang)[:, None]
        sx = ox + ux * dists[None, :]                   # (A,M)
        sy = oy + uy * dists[None, :]

        elev = self.sample_bilinear(sx, sy)             # (A,M), NaN off-map
        drop = (dists ** 2) / (2.0 * self.radius_m)     # (M,) curvature
        delta = elev - obs_elev - drop[None, :]
        with np.errstate(invalid="ignore"):
            angle = np.degrees(np.arctan2(delta, dists[None, :]))
        angle = np.where(np.isfinite(elev), angle, np.nan)

        horizon = np.nanmax(angle, axis=1)
        horizon = np.where(np.isfinite(horizon), horizon, -90.0)

        # A ray "left the map" only if it went off-map before the last sample.
        # Rays on-map all the way read the full 150 km; rays that left read the
        # distance of their last on-map sample.
        valid = np.isfinite(elev)
        any_valid = valid.any(axis=1)
        last_valid_idx = valid.shape[1] - 1 - np.argmax(valid[:, ::-1], axis=1)
        reached_end = valid[:, -1]
        reach = np.where(reached_end, MAX_RANGE_M,
                         np.where(any_valid, dists[last_valid_idx], 0.0))

        return horizon.astype(np.float32), reach.astype(np.float32)
