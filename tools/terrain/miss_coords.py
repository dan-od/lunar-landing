"""Reference coordinates for the Miss map's readouts.

For a spread of east/north offsets around the IM-2 target, computes the
latitude and longitude exactly as grid.py does (offset along the local east
and north map vectors, then the elevation map's own inverse projection via
pyproj) and writes them to core/src/fixtures/lola-offsets.json. The core
library's projection code is tested against this file.
"""
import json
import numpy as np
from terrain import Terrain

LAT, LON = -84.78, 29.13
OFFSETS = [(0, 0), (40, -120), (-160, 120), (300, 0), (0, 300), (-300, 0), (0, -300),
           (400, 400), (-400, -400), (400, -400), (-400, 400), (12.5, -7.25), (1000, 2500)]


def main():
    t = Terrain()
    ox, oy = t.lonlat_to_xy(LON, LAT)
    north, east = t.north_east_map(LON)
    rows = []
    for e, n in OFFSETS:
        x = ox + e * east[0] + n * north[0]
        y = oy + e * east[1] + n * north[1]
        lon, lat = t.xy_to_lonlat(x, y)
        rows.append({"east": e, "north": n, "lat": round(float(lat), 10), "lon_east": round(float(lon) % 360, 10)})
    out = {
        "source": "tools/terrain/miss_coords.py (pyproj, the elevation map's own projection)",
        "projection": t.crs.to_proj4(),
        "radius_m": t.radius_m,
        "target": {"lat": LAT, "lon_east": LON},
        "points": rows,
    }
    path = "../../core/src/fixtures/lola-offsets.json"
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    for r in rows:
        print(r)


if __name__ == "__main__":
    main()
