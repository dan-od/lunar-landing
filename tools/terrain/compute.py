"""Compute a site's horizon grid on a chosen map.

Shared by the worker and by build_profile.py, so the grid is defined in exactly
one place. A grid point at (offset_east, offset_north) metres is placed by a
true geodesic from the site, and its 360-direction horizon is walked on the map.
"""
from __future__ import annotations

import math

import numpy as np
from pyproj import Geod

import maps


def grid_offsets(half_m: int, step_m: int) -> list[int]:
    return list(range(-half_m, half_m + 1, step_m))


def site_profile(lm: maps.LoadedMap, lon: float, lat: float,
                 half_m: int, step_m: int, radius_m: float, ray_range_m: float,
                 height_decimals: int = 4) -> dict:
    """Return a terrain-file document (horizon_profiles shape) for one site."""
    geod = Geod(a=radius_m, f=0.0)
    offsets = grid_offsets(half_m, step_m)
    lm.ensure_region(lat, lon, ray_range_m + math.hypot(half_m, half_m))

    points = []
    all_full = True
    for on in offsets:                      # north offset, metres
        for oe in offsets:                  # east offset, metres
            dist = math.hypot(oe, on)
            if dist == 0:
                plon, plat = lon, lat
            else:
                brg = math.degrees(math.atan2(oe, on)) % 360.0   # cw from north
                plon, plat, _ = geod.fwd(lon, lat, brg, dist)
            horizon, reach = maps.horizon_profile(lm, plat, plon, ray_range_m)
            if np.any(reach < ray_range_m - 1):
                all_full = False
            points.append({
                "offset_east": int(oe),
                "offset_north": int(on),
                "heights_deg": [round(float(h), height_decimals) for h in horizon],
            })

    return {
        "model": "terrain",
        "map_name": lm.entry.name,
        "map_version": lm.entry.version,
        "resolution_m": lm.entry.resolution_m,
        "target": {"lat": lat, "lon_east": lon},
        "grid": {"half_m": half_m, "step_m": step_m, "count": len(points),
                 "units": "metres from target, east and north"},
        "azimuth": {"count": 360,
                    "convention": "heights_deg index = degrees clockwise from north"},
        "observer_height_m": maps.OBSERVER_HEIGHT_M,
        "max_range_m": ray_range_m,
        "rays_reached_full_range": all_full,
        "points": points,
    }
