"""Step 6: direction convention check (requirement F-6).

Verifies, from the file's own projection and independent geodesy rather than
from any stated formula, that:

  A. local north on the map is (sin L, cos L) and local east is (cos L, -sin L);
  B. a map step along azimuth A, where the step direction is (sin(L+A),
     cos(L+A)), has true geodesic bearing A clockwise from north -- so the
     terrain profile's azimuth index is true compass bearing;
  C. this matches the azimuth convention stated in the NASA Horizons fixture
     header, so a Sun azimuth from NASA lands on the right terrain index.

Then it pairs the fixture's Sun azimuth at one hour with the terrain horizon in
that direction and saves a compass plot as proof.
"""
import os
import re
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pyproj import Geod
from terrain import Terrain

LAT, LON = -84.78, 29.13
FIXTURE = "../../server/test/fixtures/horizons_sun_im2_2025-03-06_08.txt"
DEMO_ROW = "2025-Mar-06 08:00"   # one hour, Sun near 2 deg


def norm360(a):
    return a % 360.0


def read_fixture():
    """Return (convention_line, sun_az, sun_elev) read from the fixture."""
    conv, az, el = None, None, None
    with open(FIXTURE) as fh:
        lines = fh.readlines()
    for ln in lines:
        if "clockwise from north" in ln.lower():
            conv = ln.strip()
        if DEMO_ROW in ln:
            m = re.search(r"(\d+\.\d+)\s+(-?\d+\.\d+)\s*$", ln.strip())
            if m:
                az, el = float(m.group(1)), float(m.group(2))
    return conv, az, el


def main():
    t = Terrain()
    geod = Geod(a=t.radius_m, f=0.0)   # Moon sphere from the file's ellipsoid
    ox, oy = t.lonlat_to_xy(LON, LAT)

    print("=== A. North/East map vectors from the projection ===")
    north, east = t.north_east_map(LON)
    print("claimed north (sin L, cos L) = (%.4f, %.4f)" % (north[0], north[1]))
    print("claimed east  (cos L,-sin L) = (%.4f, %.4f)" % (east[0], east[1]))
    for name, vec in (("north", north), ("east", east)):
        x2, y2 = ox + vec[0] * 1000, oy + vec[1] * 1000  # step 1 km
        lon2, lat2 = t.xy_to_lonlat(x2, y2)
        dlon = (lon2 - LON + 180) % 360 - 180
        print("  step 1 km %-5s -> dlat %+8.5f deg, dlon %+8.5f deg" %
              (name, lat2 - LAT, dlon))
    print("  expect: north -> lat increases, lon ~0 ; east -> lon increases, lat ~0")

    print("\n=== B. Azimuth = true geodesic bearing (independent of the formula) ===")
    print("%6s  %14s  %14s  %10s" % ("A(deg)", "map step dir", "geodesic az", "error"))
    worst = 0.0
    for A in [0, 45, 70.544, 90, 135, 180, 225, 270, 315]:
        ang = np.radians(LON + A)
        dx, dy = np.sin(ang), np.cos(ang)
        x2, y2 = ox + dx * 5000, oy + dy * 5000   # 5 km along the ray
        lon2, lat2 = t.xy_to_lonlat(x2, y2)
        fwd_az, _, _ = geod.inv(LON, LAT, lon2, lat2)
        fwd_az = norm360(fwd_az)
        err = (fwd_az - A + 180) % 360 - 180
        worst = max(worst, abs(err))
        print("%6.2f  (%+.3f,%+.3f)  %14.4f  %+9.4f" % (A, dx, dy, fwd_az, err))
    print("worst azimuth error over the circle: %.4f deg" % worst)
    convention_ok = worst < 0.05

    print("\n=== C. Horizons fixture convention + F-6 pairing ===")
    conv, sun_az, sun_el = read_fixture()
    print("fixture header : %s" % conv)
    print("fixture Sun    : %s UTC  az %.3f deg, elev %.3f deg" %
          (DEMO_ROW, sun_az, sun_el))
    horizon, reach = t.horizon_profile(LAT, LON)
    idx = int(round(sun_az)) % 360
    terr = float(horizon[idx])
    print("terrain index  : az bin %d  (nearest whole degree to %.3f)" % (idx, sun_az))
    print("terrain horizon: %.3f deg in that direction" % terr)
    lit = sun_el > terr
    print("verdict        : Sun elev %.3f %s terrain horizon %.3f  -> %s" %
          (sun_el, ">" if lit else "<=", terr, "LIT" if lit else "in shadow"))
    # where that bearing points on the map, for the plot
    ang = np.radians(LON + sun_az)
    smap = (np.sin(ang), np.cos(ang))
    print("map bearing    : Sun direction on map = (%.3f, %.3f) (+x east,+y north)" %
          smap)

    # --- plot -----------------------------------------------------------------
    az = np.radians(np.arange(360))
    fig = plt.figure(figsize=(6.2, 6.4))
    ax = fig.add_subplot(111, projection="polar")
    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)   # clockwise: N(0) -> E(90) -> S(180) -> W(270)
    ax.plot(az, horizon, color="#2E96F5", lw=1.2, label="terrain horizon (deg)")
    ax.plot([np.radians(sun_az)], [sun_el], marker="o", color="#EAFE07",
            markeredgecolor="#07173F", markersize=11, zorder=5,
            label="Sun %.1f deg az, %.2f deg el" % (sun_az, sun_el))
    ax.set_rlabel_position(135)
    ax.set_title("IM-2 target horizon, azimuth clockwise from north\n"
                 "Sun at %s UTC (NASA Horizons)" % DEMO_ROW, fontsize=10)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, -0.18), fontsize=8)
    fig.tight_layout()
    os.makedirs("out", exist_ok=True)
    out = "out/direction_check.png"
    fig.savefig(out, dpi=130)
    print("\nsaved plot     : %s" % out)

    ok = convention_ok and (conv is not None) and ("clockwise from north" in (conv or "").lower())
    print("\nF-6 result     : %s" %
          ("PASS - terrain azimuth == NASA azimuth (clockwise from north)"
           if ok else "FAIL - conventions differ, STOP"))
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
