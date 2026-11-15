"""Step 4: horizon profile for one point, timed.

Computes the 360-direction horizon for the IM-2 target: 2 m observer, out to
150 km, curvature-corrected, bilinear elevation. Prints the run time and a
summary, and saves the profile so it can be inspected.
"""
import time
import numpy as np
from terrain import Terrain, MAX_RANGE_M

LAT, LON = -84.78, 29.13  # IM-2 target


def main():
    t = Terrain()
    t0 = time.perf_counter()
    horizon, reach = t.horizon_profile(LAT, LON)
    dt = time.perf_counter() - t0

    az = np.arange(360)
    amax = int(np.argmax(horizon))
    amin = int(np.argmin(horizon))
    left_early = int(np.sum(reach < MAX_RANGE_M - 1))

    print("Point        : %.2f, %.2f  (lat, lon east)" % (LAT, LON))
    print("Run time     : %.3f s" % dt)
    print("Observer      : surface + 2 m")
    print("Rays to 150 km: %d of 360   (%d left the map early)" %
          (360 - left_early, left_early))
    print("Horizon angle : min %.3f deg (az %d), max %.3f deg (az %d), mean %.3f deg" %
          (horizon[amin], amin, horizon[amax], amax, float(np.mean(horizon))))
    # The Sun at the demo hour sits near 2 deg at azimuth ~70; show that bearing.
    print("At az 070     : horizon %.3f deg, ray reached %.1f km" %
          (horizon[70], reach[70] / 1000))
    print("At az 250     : horizon %.3f deg, ray reached %.1f km" %
          (horizon[250], reach[250] / 1000))

    np.savez("profiles/im2_target.npz", lat=LAT, lon=LON,
             horizon=horizon, reach=reach, azimuth=az)
    print("saved         : profiles/im2_target.npz")


if __name__ == "__main__":
    main()
