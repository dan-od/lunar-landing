"""Build a committed terrain profile file for the Miss tab.

Emits tools/terrain/<site>_terrain.json: the horizon grid around one site, in the shape the server's horizon_profiles table expects
(site_id, offset_east, offset_north, heights_deg[360]) and naming the model
("terrain"), per the PRD contract that every reply and file names its model.

This is the one file the Miss flow reads. The .npz outputs under out/ are
working artifacts and are not committed.
"""
import argparse
import json
import time
import numpy as np
from terrain import (Terrain, OBSERVER_HEIGHT_M, MAX_RANGE_M, N_AZIMUTHS)

# Sites with prepared terrain, all inside the LOLA 80 S map. Coordinates are
# the cited ones in core/src/sites.ts.
SITES = {
    "im2": ("IM-2 target, Mons Mouton", -84.78, 29.13),
    "im2a": ("IM-2 Athena, where it came to rest", -84.7906, 29.1957),
    "shk": ("Shackleton-de Gerlache ridge", -89.684, 196.739),
}
HALF_M = 400                 # cover >= 320 m in every direction (req 4-1)
STEP_M = 40
DEM_NAME = "LDEM_80S_80MPP_ADJ.TIF"
HEIGHT_DECIMALS = 4


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("site", nargs="?", default="im2", choices=sorted(SITES))
    SITE_ID = ap.parse_args().site
    SITE_NAME, LAT, LON = SITES[SITE_ID]
    OUT_FILE = "%s_terrain.json" % SITE_ID
    t = Terrain()
    offsets = list(range(-HALF_M, HALF_M + 1, STEP_M))   # -400..400, 21 values
    ox, oy = t.lonlat_to_xy(LON, LAT)
    north, east = t.north_east_map(LON)

    points = []
    all_full = True
    short_dirs = set()          # directions (deg from north) where a ray left the map
    shortest = MAX_RANGE_M
    t0 = time.perf_counter()
    for on in offsets:              # north offset (metres)
        for oe in offsets:          # east offset (metres)
            x = ox + oe * east[0] + on * north[0]
            y = oy + oe * east[1] + on * north[1]
            lon_i, lat_i = t.xy_to_lonlat(x, y)
            horizon, reach = t.horizon_profile(lat_i, lon_i)
            cut = np.nonzero(reach < MAX_RANGE_M - 1)[0]
            if cut.size:
                all_full = False
                short_dirs.update(int(a) for a in cut)
                shortest = min(shortest, float(reach.min()))
            points.append({
                "offset_east": int(oe),
                "offset_north": int(on),
                "heights_deg": [round(float(h), HEIGHT_DECIMALS) for h in horizon],
            })
    dt = time.perf_counter() - t0

    doc = {
        "model": "terrain",
        "site_id": SITE_ID,
        "site_name": SITE_NAME,
        "target": {"lat": LAT, "lon_east": LON},
        "source_dem": DEM_NAME,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "grid": {
            "half_m": HALF_M, "step_m": STEP_M,
            "count": len(points), "units": "metres from target, east and north",
        },
        "azimuth": {
            "count": N_AZIMUTHS,
            "convention": "heights_deg index = degrees clockwise from north "
                          "(index 0 = north, 90 = east); same as NASA Horizons "
                          "azimuth, verified in direction_check.py (F-6)",
        },
        "observer_height_m": OBSERVER_HEIGHT_M,
        "max_range_m": MAX_RANGE_M,
        "rays_reached_full_range": all_full,
        "rays_cut_directions_deg": sorted(short_dirs),
        "shortest_ray_m": round(shortest),
        "points": points,
    }

    with open(OUT_FILE, "w") as fh:
        json.dump(doc, fh, separators=(",", ":"))
        fh.write("\n")

    import os
    size = os.path.getsize(OUT_FILE)
    print("site          : %s (%s)" % (SITE_ID, doc["site_name"]))
    print("grid          : %d points, +/-%d m step %d m" % (len(points), HALF_M, STEP_M))
    print("build time    : %.1f s" % dt)
    print("all rays 150km: %s" % all_full)
    if short_dirs:
        d = sorted(short_dirs)
        print("rays cut      : %d directions, %d..%d deg from north; shortest %.0f m" % (len(d), d[0], d[-1], shortest))
    print("model named   : %s" % doc["model"])
    print("wrote         : tools/terrain/%s  (%d bytes, %.2f MB)" %
          (OUT_FILE, size, size / 1e6))


if __name__ == "__main__":
    main()
