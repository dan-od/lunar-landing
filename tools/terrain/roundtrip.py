"""Step 3: latitude/longitude to pixel and back, with a round-trip test.

Exercises lon/lat -> projected x,y -> fractional pixel -> x,y -> lon/lat over
the IM-2 target and a spread of nearby points, and asserts the trip returns to
where it started. Exits non-zero if any point drifts past tolerance.
"""
import sys
import numpy as np
from terrain import Terrain

# (lon east, lat) samples: the target and points offset around it
POINTS = [
    (29.13, -84.78),     # IM-2 target
    (0.0, -89.99),       # near the pole
    (29.13, -84.0),
    (30.0, -84.78),
    (120.0, -86.5),
    (-75.0, -83.2),
    (200.0, -88.0),
]

TOL_M = 1e-3      # projected round-trip tolerance (1 mm)
TOL_DEG = 1e-6    # geographic round-trip tolerance


def main():
    t = Terrain()
    print("%-22s %-20s %-16s %-22s %s" %
          ("input lon,lat", "proj x,y (m)", "pixel col,row", "back lon,lat", "max drift"))
    worst = 0.0
    ok = True
    for lon, lat in POINTS:
        x, y = t.lonlat_to_xy(lon, lat)
        col, row = t.xy_to_pixel(x, y)
        x2, y2 = t.pixel_to_xy(col, row)
        lon2, lat2 = t.xy_to_lonlat(x2, y2)

        proj_drift = max(abs(x - x2), abs(y - y2))
        # wrap longitude difference into -180..180 before comparing
        dlon = (lon - lon2 + 180) % 360 - 180
        geo_drift = max(abs(dlon), abs(lat - lat2))
        worst = max(worst, geo_drift)

        print("%-22s %-20s %-16s %-22s proj %.2e m / geo %.2e deg" % (
            "%.3f, %.3f" % (lon, lat),
            "%.1f, %.1f" % (x, y),
            "%.2f, %.2f" % (col, row),
            "%.5f, %.5f" % (lon2, lat2),
            proj_drift, geo_drift))

        if proj_drift > TOL_M or geo_drift > TOL_DEG:
            ok = False

    print("\nworst geographic drift: %.3e deg (%.3f mm on the ground)" %
          (worst, np.radians(worst) * t.radius_m * 1000))
    if not ok:
        print("ROUND TRIP FAILED")
        sys.exit(1)
    print("round trip OK")


if __name__ == "__main__":
    main()
