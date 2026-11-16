"""Validation: 120 m south map vs the committed 80 m results.

Recomputes the three sites that already have 80 m profiles (IM-2, IM-2 actual,
Shackleton) from the 120 m south map on the same grid, and reports the largest
horizon difference in degrees. Exits non-zero (stop) if it exceeds 1 degree.
"""
import json
import os
import sys

import numpy as np

import compute
import maps

DATA_ROOT = os.environ.get("TERRAIN_DATA_ROOT", "/Users/ds/Codes/nasa")
SITES = [("im2", "im2_terrain.json"),
         ("im2a", "im2a_terrain.json"),
         ("shk", "shk_terrain.json")]
MAP_NAME = "LDEM_60S_120M"
THRESHOLD_DEG = 1.0


def load_committed(path):
    doc = json.load(open(path))
    target = doc["target"]
    grid = doc["grid"]
    by_off = {(p["offset_east"], p["offset_north"]): np.array(p["heights_deg"])
              for p in doc["points"]}
    return target["lat"], target["lon_east"], grid["half_m"], grid["step_m"], by_off


def main():
    cat = maps.Catalogue()
    entry = cat.maps[MAP_NAME]
    overall = 0.0
    print(f"map: {MAP_NAME} ({entry.resolution_m} m)  vs committed 80 m\n")
    for site, fname in SITES:
        lat, lon, half, step, old = load_committed(os.path.join(maps.HERE, fname))
        lm = maps.LoadedMap(entry, DATA_ROOT, cat.radius_m)
        try:
            doc = compute.site_profile(lm, lon, lat, half, step, cat.radius_m, cat.ray_range_m)
        finally:
            lm.close()
        new = {(p["offset_east"], p["offset_north"]): np.array(p["heights_deg"])
               for p in doc["points"]}
        diffs = [np.max(np.abs(new[k] - old[k])) for k in old if k in new]
        site_max = float(np.max(diffs))
        mean = float(np.mean([np.mean(np.abs(new[k] - old[k])) for k in old if k in new]))
        overall = max(overall, site_max)
        print(f"{site:5s} ({lat:+.4f},{lon:7.3f}): max |Δhorizon| = {site_max:.4f} deg, mean {mean:.4f} deg over {len(diffs)} points")

    print(f"\nlargest horizon difference overall: {overall:.4f} deg (threshold {THRESHOLD_DEG})")
    if overall > THRESHOLD_DEG:
        print("STOP: 120 m and 80 m results differ by more than 1 degree.")
        sys.exit(1)
    print("OK: within 1 degree.")


if __name__ == "__main__":
    main()
