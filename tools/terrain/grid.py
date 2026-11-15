"""Step 5: horizon profiles for a grid around the IM-2 target.

A square grid in local east/north offsets, -400 m to +400 m in 40 m steps
(21 x 21 = 441 points), which covers at least 400 m in every direction and so
satisfies requirement 4-1 (grid covers at least 320 m in every direction).

Each point stores its 360-direction horizon and per-direction reach. Output
goes to profiles/im2_grid.npz, which is generated data and is not committed.
"""
import os
import time
import numpy as np
from terrain import Terrain

LAT, LON = -84.78, 29.13
HALF_M = 400.0
STEP_M = 40.0
OUT = "out"               # generated artifacts (git-ignored)


def main():
    t = Terrain()
    offsets = np.arange(-HALF_M, HALF_M + 1, STEP_M)   # -400..400 -> 21 values
    n = len(offsets)
    ox, oy = t.lonlat_to_xy(LON, LAT)
    north, east = t.north_east_map(LON)

    oe, on = np.meshgrid(offsets, offsets)             # east, north offsets
    oe = oe.ravel()
    on = on.ravel()
    total = oe.size

    lon_g = np.empty(total)
    lat_g = np.empty(total)
    horizon_g = np.empty((total, 360), dtype=np.float32)
    reach_g = np.empty((total, 360), dtype=np.float32)

    print("Grid         : %d x %d = %d points, offsets %+d..%+d m step %d m" %
          (n, n, total, -int(HALF_M), int(HALF_M), int(STEP_M)))
    t0 = time.perf_counter()
    for i in range(total):
        x = ox + oe[i] * east[0] + on[i] * north[0]
        y = oy + oe[i] * east[1] + on[i] * north[1]
        lon_i, lat_i = t.xy_to_lonlat(x, y)
        lon_g[i] = lon_i
        lat_g[i] = lat_i
        horizon_g[i], reach_g[i] = t.horizon_profile(lat_i, lon_i)
    dt = time.perf_counter() - t0

    left_any = int(np.sum(np.any(reach_g < 150_000 - 1, axis=1)))
    print("Run time     : %.1f s  (%.3f s per point)" % (dt, dt / total))
    print("Coverage     : +/-%d m east and north -> satisfies 4-1 (>= 320 m)" %
          int(HALF_M))
    print("Horizon range: %.3f to %.3f deg across the grid" %
          (float(horizon_g.min()), float(horizon_g.max())))
    print("Rays off-map : %d of %d points had any ray leave before 150 km" %
          (left_any, total))

    os.makedirs(OUT, exist_ok=True)
    np.savez_compressed(os.path.join(OUT, "im2_grid.npz"),
                        lat0=LAT, lon0=LON, offsets=offsets,
                        offset_east=oe.astype(np.float32),
                        offset_north=on.astype(np.float32),
                        lon=lon_g, lat=lat_g,
                        horizon=horizon_g, reach=reach_g)
    print("saved         : %s/im2_grid.npz" % OUT)


if __name__ == "__main__":
    main()
