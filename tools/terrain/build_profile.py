"""Build the committed terrain profile file for the Miss tab.

Emits tools/terrain/im2_terrain.json: the horizon grid around the IM-2 demo
site, in the shape the server's horizon_profiles table expects
(site_id, offset_east, offset_north, heights_deg[360]) and naming the model
("terrain"), per the PRD contract that every reply and file names its model.

This is the one file the Miss flow reads. The .npz outputs under out/ are
working artifacts and are not committed.
"""
import json
import time
import numpy as np
from terrain import (Terrain, OBSERVER_HEIGHT_M, MAX_RANGE_M, N_AZIMUTHS)

SITE_ID = "im2"
LAT, LON = -84.78, 29.13     # IM-2 target, Mons Mouton
HALF_M = 400                 # cover >= 320 m in every direction (req 4-1)
STEP_M = 40
DEM_NAME = "LDEM_80S_80MPP_ADJ.TIF"
OUT_FILE = "im2_terrain.json"
HEIGHT_DECIMALS = 4


def main():
    t = Terrain()
    offsets = list(range(-HALF_M, HALF_M + 1, STEP_M))   # -400..400, 21 values
    ox, oy = t.lonlat_to_xy(LON, LAT)
    north, east = t.north_east_map(LON)

    points = []
    all_full = True
    t0 = time.perf_counter()
    for on in offsets:              # north offset (metres)
        for oe in offsets:          # east offset (metres)
            x = ox + oe * east[0] + on * north[0]
            y = oy + oe * east[1] + on * north[1]
            lon_i, lat_i = t.xy_to_lonlat(x, y)
            horizon, reach = t.horizon_profile(lat_i, lon_i)
            if np.any(reach < MAX_RANGE_M - 1):
                all_full = False
            points.append({
                "offset_east": int(oe),
                "offset_north": int(on),
                "heights_deg": [round(float(h), HEIGHT_DECIMALS) for h in horizon],
            })
    dt = time.perf_counter() - t0

    doc = {
        "model": "terrain",
        "site_id": SITE_ID,
        "site_name": "IM-2 target, Mons Mouton",
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
    print("model named   : %s" % doc["model"])
    print("wrote         : tools/terrain/%s  (%d bytes, %.2f MB)" %
          (OUT_FILE, size, size / 1e6))


if __name__ == "__main__":
    main()
