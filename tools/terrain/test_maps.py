"""Tests for the map catalogue, map choice, the seam, and the geodesic horizon.

Runnable directly (./.venv/bin/python test_maps.py) or under pytest. Tests that
need a map that is not downloaded yet are skipped with a printed reason, so this
passes today and strengthens as the maps arrive.
"""
import os
import tempfile

import numpy as np
import rasterio
from rasterio.transform import from_origin

import maps

DATA_ROOT = os.path.abspath(os.path.join(maps.HERE, "..", ".."))  # repo root holds data/
IM2 = (29.13, -84.78)   # lon, lat


def _cat():
    return maps.Catalogue()


def test_catalogue_loads_and_orders():
    cat = _cat()
    assert cat.radius_m == 1737400
    assert cat.ray_range_m == 150000
    assert cat.order[0] == "LDEM_80S_80MPP"       # finest south map first
    assert cat.order[-1] == "LDEM_128"            # global fallback last
    # resolution is non-decreasing along the order (best first)
    res = [cat.maps[n].resolution_m for n in cat.order]
    assert res == sorted(res)
    print("ok catalogue loads and is ordered best-first")


def test_size_verify_present_and_missing():
    cat = _cat()
    ok80, msg80 = cat.verify_size(cat.maps["LDEM_80S_80MPP"], DATA_ROOT)
    assert ok80, msg80                            # 80 m map present, exact size
    ok60, msg60 = cat.verify_size(cat.maps["LDEM_60S_120M"], DATA_ROOT)
    assert not ok60 and msg60 == "missing"        # not downloaded yet
    print("ok size verify:", msg80, "| 60S:", msg60)


def test_band_filter():
    cat = _cat()
    assert maps.band_covers(cat.maps["LDEM_80S_80MPP"], -84.78)
    assert not maps.band_covers(cat.maps["LDEM_80S_80MPP"], -70.0)   # outside 80-90 S
    assert maps.band_covers(cat.maps["LDEM_60S_120M"], -70.0)        # 60-90 S
    assert maps.band_covers(cat.maps["LDEM_60N_120M"], 75.0)
    assert maps.band_covers(cat.maps["LDEM_128"], 0.67)              # global covers all
    print("ok coverage-band filter")


def test_choose_map_im2_prefers_80m():
    cat = _cat()
    chosen = maps.choose_map(cat, IM2[0], IM2[1], DATA_ROOT)
    assert chosen is not None and chosen.name == "LDEM_80S_80MPP", chosen
    print("ok IM-2 chooses the 80 m south map")


def test_choose_map_skips_missing_falls_to_present():
    # Chandrayaan-3 at 69.37 S needs the 120 m south map (not downloaded) or the
    # global map. With the 120 m map missing, choice must skip it; today only the
    # global map could serve it, but the global map is incomplete, so this just
    # asserts the chooser never returns a map whose file is absent.
    cat = _cat()
    chosen = maps.choose_map(cat, 32.319, -69.373, DATA_ROOT)
    if chosen is not None:
        assert os.path.exists(cat.maps[chosen.name].path(DATA_ROOT))
        print("ok Chandrayaan-3 chose a present map:", chosen.name)
    else:
        print("skip Chandrayaan-3: no present map covers it yet (120 m / global downloading)")


def test_horizon_matches_committed_profile():
    """The geodesic horizon on the 80 m map reproduces the committed IM-2 value."""
    cat = _cat()
    lm = maps.LoadedMap(cat.maps["LDEM_80S_80MPP"], DATA_ROOT, cat.radius_m)
    try:
        horizon, reach = maps.horizon_profile(lm, IM2[1], IM2[0], cat.ray_range_m)
    finally:
        lm.close()
    # committed im2_terrain.json center point reported az71 horizon ~1.228 deg
    assert abs(horizon[71] - 1.228) < 0.03, horizon[71]
    assert np.all(reach > 149000)                 # 165 km from the nearest edge
    print("ok geodesic horizon az71 = %.3f deg (committed ~1.228)" % horizon[71])


def _make_equirect(path, res_px_per_deg=1.0):
    """A tiny whole-Moon equirectangular GeoTIFF: elevation = f(lon) with a value
    that is continuous across the 0/360 seam, so we can test seam sampling."""
    w, h = int(360 * res_px_per_deg), int(180 * res_px_per_deg)
    lons = (np.arange(w) + 0.5) / res_px_per_deg               # 0..360 pixel centres
    row = 1000.0 * np.cos(np.radians(lons))                    # smooth, period 360
    data = np.repeat(row[None, :], h, axis=0).astype(np.float32)
    transform = from_origin(0.0, 90.0, 1.0 / res_px_per_deg, 1.0 / res_px_per_deg)
    with rasterio.open(path, "w", driver="GTiff", width=w, height=h, count=1,
                       dtype="float32", transform=transform, crs="EPSG:4326") as ds:
        ds.write(data, 1)


def test_seam_is_seamless():
    cat = _cat()
    with tempfile.TemporaryDirectory() as d:
        os.makedirs(os.path.join(d, "data"), exist_ok=True)
        tif = os.path.join(d, "data", "equi.tif")
        _make_equirect(tif, res_px_per_deg=2.0)
        entry = maps.MapEntry(
            name="TEST_EQ", file="equi.tif", dir="data", format="geotiff", label=None,
            resolution_m=237, projection="equirectangular",
            coverage={"lat_min": -90, "lat_max": 90, "lon_min": 0, "lon_max": 360},
            source_url="x", byte_size=None, version="test")
        lm = maps.LoadedMap(entry, d, cat.radius_m)
        try:
            # sampling just either side of the seam must be continuous
            a = float(lm.sample_bilinear(np.array([0.1]), np.array([0.0]))[0])
            b = float(lm.sample_bilinear(np.array([359.9]), np.array([0.0]))[0])
            expect_a = 1000.0 * np.cos(np.radians(0.1))
            expect_b = 1000.0 * np.cos(np.radians(359.9))
            assert abs(a - expect_a) < 5, (a, expect_a)
            assert abs(b - expect_b) < 5, (b, expect_b)
            # a value exactly at the seam read from lon=360 equals lon=0
            s0 = float(lm.sample_bilinear(np.array([0.0]), np.array([0.0]))[0])
            s360 = float(lm.sample_bilinear(np.array([360.0]), np.array([0.0]))[0])
            assert abs(s0 - s360) < 1e-6, (s0, s360)
        finally:
            lm.close()
    print("ok equirectangular seam is seamless (lon 0 == lon 360)")


def main():
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
    print("\nall map tests passed")


if __name__ == "__main__":
    main()
