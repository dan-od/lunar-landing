"""Map catalogue, multi-map reader and map choice for the terrain worker.

Any site inside a downloaded elevation map gets a real horizon profile. A map
is chosen best-first (finest resolution that covers the point with the full
150 km ray range inside it); the whole-Moon map is the equirectangular
fallback and its longitude seam is handled.

Projection and units are read from each file -- the GeoTIFF CRS or the PDS
label -- and never assumed. The horizon is walked along true geodesics on the
Moon sphere, so one code path serves polar and equirectangular maps alike and
the azimuth is true degrees clockwise from north (the F-6 convention).
"""
from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass

import numpy as np
import rasterio
from pyproj import CRS, Geod, Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOGUE_PATH = os.path.join(HERE, "maps.json")

OBSERVER_HEIGHT_M = 2.0
N_AZIMUTHS = 360
STEP_BASE_M = 40.0
STEP_GROWTH = 0.03


# --------------------------------------------------------------------------- #
# Catalogue
# --------------------------------------------------------------------------- #
@dataclass
class MapEntry:
    name: str
    file: str
    dir: str
    format: str            # "geotiff" | "pds_img"
    label: str | None
    resolution_m: float
    projection: str        # "polar_stereographic_south|north" | "equirectangular"
    coverage: dict
    source_url: str
    byte_size: int | None
    version: str

    def path(self, data_root: str) -> str:
        return os.path.join(data_root, self.dir, self.file)

    def label_path(self, data_root: str) -> str | None:
        return os.path.join(data_root, self.dir, self.label) if self.label else None


class Catalogue:
    def __init__(self, path: str = CATALOGUE_PATH):
        with open(path) as fh:
            doc = json.load(fh)
        self.radius_m = float(doc["radius_m"])
        self.ray_range_m = float(doc["ray_range_m"])
        self.maps = {m["name"]: MapEntry(**{k: m[k] for k in (
            "name", "file", "dir", "format", "label", "resolution_m",
            "projection", "coverage", "source_url", "byte_size", "version")})
            for m in doc["maps"]}
        self.order = list(doc["order"])

    def ordered(self) -> list[MapEntry]:
        return [self.maps[n] for n in self.order]

    def verify_size(self, entry: MapEntry, data_root: str) -> tuple[bool, str]:
        """Compare the file's byte size to the catalogue. Unknown sizes pass."""
        p = entry.path(data_root)
        if not os.path.exists(p):
            return False, "missing"
        actual = os.path.getsize(p)
        if entry.byte_size is None:
            return True, f"present ({actual} bytes, catalogue size not recorded)"
        if actual != entry.byte_size:
            return False, f"size {actual} != catalogue {entry.byte_size}"
        return True, f"ok ({actual} bytes)"


# --------------------------------------------------------------------------- #
# Loaded map (one open raster, with label verification)
# --------------------------------------------------------------------------- #
_LBL_KV = re.compile(r"^\s*([A-Z_^][A-Z0-9_]*)\s*=\s*(.+?)\s*$", re.MULTILINE)


def read_label(label_path: str) -> dict:
    """Parse the simple KEY = VALUE pairs of a PDS label (enough to verify)."""
    with open(label_path, "r", errors="replace") as fh:
        text = fh.read()
    out: dict[str, str] = {}
    for m in _LBL_KV.finditer(text):
        out.setdefault(m.group(1), m.group(2).strip().strip('"'))
    return out


class LoadedMap:
    """One elevation map, opened and verified, sampled in metres above the sphere."""

    def __init__(self, entry: MapEntry, data_root: str, radius_m: float):
        self.entry = entry
        self.radius_m = radius_m
        self.is_equirect = entry.projection == "equirectangular"
        src = entry.label_path(data_root) if entry.format == "pds_img" else entry.path(data_root)
        self.ds = rasterio.open(src)
        self.width = self.ds.width
        self.height = self.ds.height
        self.transform = self.ds.transform
        self.nodata = self.ds.nodata
        self._verify(data_root)

        # metres-per-unit to convert raw samples to metres above the sphere
        self._to_m = 1000.0 if self._unit_is_km(data_root) else 1.0
        if self.is_equirect:
            self._setup_equirect(data_root)
        else:
            self.crs = CRS.from_user_input(self.ds.crs)
            geog = self.crs.geodetic_crs
            self._fwd = Transformer.from_crs(geog, self.crs, always_xy=True)
        self._cache: np.ndarray | None = None       # loaded array (full or window)
        self._origin = (0, 0)                        # (row0, col0) of the cache

    def _setup_equirect(self, data_root: str) -> None:
        """Pixel-registration parameters for a simple-cylindrical map, from its
        label when present (authoritative) else from the width/height."""
        if self.entry.format == "pds_img" and self.entry.label:
            lbl = read_label(self.entry.label_path(data_root))
            self._eq_res = float(lbl["MAP_RESOLUTION"].split()[0])          # pix/deg
            self._eq_center_lon = float(lbl["CENTER_LONGITUDE"].split()[0])
            self._eq_center_lat = float(lbl.get("CENTER_LATITUDE", "0").split()[0])
            self._eq_s0 = float(lbl["SAMPLE_PROJECTION_OFFSET"].split()[0])  # 0-based centre
            self._eq_l0 = float(lbl["LINE_PROJECTION_OFFSET"].split()[0])
        else:
            self._eq_res = self.width / 360.0
            self._eq_center_lon = 180.0
            self._eq_center_lat = 0.0
            self._eq_s0 = self.width / 2.0 - 0.5
            self._eq_l0 = self.height / 2.0 - 0.5

    # --- verification ---
    def _verify(self, data_root: str) -> None:
        """Confirm the projection the catalogue claims against the file itself."""
        proj = self.entry.projection
        if self.entry.format == "pds_img":
            ptype = read_label(self.entry.label_path(data_root)).get("MAP_PROJECTION_TYPE", "").upper()
            if proj == "equirectangular" and "CYLINDRICAL" not in ptype:
                raise ValueError(f"{self.entry.name}: label projection {ptype!r} is not simple cylindrical")
            if proj.startswith("polar") and "STEREOGRAPHIC" not in ptype and "POLAR" not in ptype:
                raise ValueError(f"{self.entry.name}: label projection {ptype!r} is not polar stereographic")
        else:  # geotiff
            wkt = (self.ds.crs.to_wkt() if self.ds.crs else "").lower()
            if proj.startswith("polar") and ("polar" not in wkt or "stereographic" not in wkt):
                raise ValueError(f"{self.entry.name}: CRS is not polar stereographic ({self.ds.crs})")
        # resolution sanity: projected pixel size within 5% of the catalogue
        px = abs(self.transform.a)
        if not self.is_equirect and px > 0 and abs(px - self.entry.resolution_m) / self.entry.resolution_m > 0.05:
            raise ValueError(f"{self.entry.name}: pixel {px:.1f} m != catalogue {self.entry.resolution_m} m")

    def _unit_is_km(self, data_root: str) -> bool:
        if self.entry.format == "pds_img":
            lbl = read_label(self.entry.label_path(data_root))
            return lbl.get("UNIT", "").upper().startswith("KILOMETER")
        return False  # the 80 m GeoTIFF is in metres (verified in inspect_dem.py)

    # --- pixel mapping ---
    def _lonlat_to_pixel(self, lon, lat):
        """Fractional (col, row), integers at pixel centres. Handles lon wrap."""
        if self.is_equirect:
            lon = np.asarray(lon, dtype=np.float64)
            lat = np.asarray(lat, dtype=np.float64)
            # wrap longitude into (center-180, center+180] so the seam is seamless
            dlon = (lon - self._eq_center_lon + 180.0) % 360.0 - 180.0
            col = self._eq_s0 + dlon * self._eq_res
            row = self._eq_l0 - (lat - self._eq_center_lat) * self._eq_res
            return col, row
        x, y = self._fwd.transform(lon, lat)
        col = (np.asarray(x) - self.transform.c) / self.transform.a - 0.5
        row = (np.asarray(y) - self.transform.f) / self.transform.e - 0.5
        return col, row

    # --- region loading ---
    FULL_LOAD_MAX_CELLS = 100_000_000   # ~0.8 GB float64; above this, window instead

    def load_full(self) -> None:
        if self._cache is None:
            self._cache = self._read_band(0, self.height)
            self._origin = (0, 0)

    def ensure_region(self, lat: float, range_m: float) -> None:
        """Load the rows needed for a range_m disc at this latitude.

        Equirectangular maps keep every column (so the seam wraps) but only the
        latitude band around the site, so the whole-Moon map never loads whole.
        """
        if self._cache is not None:
            return
        if not self.is_equirect or self.height * self.width <= self.FULL_LOAD_MAX_CELLS:
            self.load_full()
            return
        dlat = math.degrees(range_m / self.radius_m) + 1.0
        r_top = self._lonlat_to_pixel(0.0, min(90.0, lat + dlat))[1]
        r_bot = self._lonlat_to_pixel(0.0, max(-90.0, lat - dlat))[1]
        row0 = max(0, int(math.floor(min(r_top, r_bot))))
        row1 = min(self.height, int(math.ceil(max(r_top, r_bot))) + 1)
        self._cache = self._read_band(row0, row1 - row0)
        self._origin = (row0, 0)

    def _read_band(self, row0, h) -> np.ndarray:
        arr = self.ds.read(1, window=((row0, row0 + h), (0, self.width))).astype(np.float64)
        if self.nodata is not None and not math.isnan(self.nodata):
            arr[arr == self.nodata] = np.nan
        return arr * self._to_m

    # --- sampling ---
    def sample_bilinear(self, lon, lat) -> np.ndarray:
        if self._cache is None:
            self.load_full()
        col, row = self._lonlat_to_pixel(lon, lat)
        col = np.asarray(col, dtype=np.float64)
        row = np.asarray(row, dtype=np.float64) - self._origin[0]
        ch, cw = self._cache.shape
        c0 = np.floor(col).astype(np.int64); r0 = np.floor(row).astype(np.int64)
        fc = col - c0; fr = row - r0
        if self.is_equirect:
            # longitude wraps: every column is present, only rows can fall outside
            inb = (r0 >= 0) & (r0 + 1 < ch)
            cc0 = np.mod(c0, self.width); cc1 = np.mod(c0 + 1, self.width)
        else:
            inb = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < cw) & (r0 + 1 < ch)
            cc0 = np.clip(c0, 0, cw - 1); cc1 = np.clip(c0 + 1, 0, cw - 1)
        rr0 = np.clip(r0, 0, ch - 1); rr1 = np.clip(r0 + 1, 0, ch - 1)
        cache = self._cache
        top = cache[rr0, cc0] * (1 - fc) + cache[rr0, cc1] * fc
        bot = cache[rr1, cc0] * (1 - fc) + cache[rr1, cc1] * fc
        out = top * (1 - fr) + bot * fr
        return np.where(inb, out, np.nan)

    # --- coverage ---
    def covers_with_range(self, lon, lat, range_m, geod: Geod) -> bool:
        """True if a full range_m disc around the point is inside the map."""
        if self.is_equirect:
            return True  # whole-Moon map covers everywhere (seam handled on the walk)
        x, y = self._fwd.transform(lon, lat)
        b = self.ds.bounds
        edge = min(x - b.left, b.right - x, y - b.bottom, b.top - y)
        if edge < range_m:
            return False
        return bool(np.isfinite(self.sample_bilinear(lon, lat)))

    def close(self) -> None:
        self.ds.close()


# --------------------------------------------------------------------------- #
# Map choice
# --------------------------------------------------------------------------- #
def band_covers(entry: MapEntry, lat: float) -> bool:
    c = entry.coverage
    return c["lat_min"] <= lat <= c["lat_max"]


def choose_map(cat: Catalogue, lon: float, lat: float, data_root: str,
               require_present: bool = True) -> MapEntry | None:
    """Best map (finest resolution) covering the point with the 150 km range inside."""
    geod = Geod(a=cat.radius_m, f=0.0)
    for entry in cat.ordered():
        if not band_covers(entry, lat):
            continue
        if require_present and not cat.verify_size(entry, data_root)[0]:
            continue   # absent, or an incomplete download (size != catalogue)
        try:
            lm = LoadedMap(entry, data_root, cat.radius_m)
        except Exception:
            continue
        try:
            if lm.covers_with_range(lon, lat, cat.ray_range_m, geod):
                return entry
        finally:
            lm.close()
    return None


# --------------------------------------------------------------------------- #
# Geodesic horizon (one code path for every projection)
# --------------------------------------------------------------------------- #
def _distances(max_range_m: float) -> np.ndarray:
    d, dist = [], STEP_BASE_M
    while dist < max_range_m:
        d.append(dist)
        dist += max(STEP_BASE_M, dist * STEP_GROWTH)
    d.append(max_range_m)
    return np.array(d)


def horizon_profile(lm: LoadedMap, lat: float, lon: float, max_range_m: float):
    """(horizon[360], reach[360]) walking true geodesics; azimuth clockwise from north."""
    geod = Geod(a=lm.radius_m, f=0.0)
    lm.ensure_region(lat, max_range_m)
    obs_surf = float(lm.sample_bilinear(np.array([lon]), np.array([lat]))[0])
    if not np.isfinite(obs_surf):
        raise ValueError("observer point has no elevation (off-map/nodata)")
    obs_elev = obs_surf + OBSERVER_HEIGHT_M

    az = np.arange(N_AZIMUTHS)
    dists = _distances(max_range_m)
    A, D = np.meshgrid(az.astype(float), dists, indexing="ij")   # (360, M)
    lons0 = np.full(A.size, lon)
    lats0 = np.full(A.size, lat)
    end_lon, end_lat, _ = geod.fwd(lons0, lats0, A.ravel(), D.ravel())
    elev = lm.sample_bilinear(end_lon, end_lat).reshape(A.shape)

    drop = (dists ** 2) / (2.0 * lm.radius_m)
    delta = elev - obs_elev - drop[None, :]
    with np.errstate(invalid="ignore"):
        angle = np.degrees(np.arctan2(delta, dists[None, :]))
    angle = np.where(np.isfinite(elev), angle, np.nan)

    horizon = np.nanmax(angle, axis=1)
    horizon = np.where(np.isfinite(horizon), horizon, -90.0)

    valid = np.isfinite(elev)
    reached_end = valid[:, -1]
    last_valid = valid.shape[1] - 1 - np.argmax(valid[:, ::-1], axis=1)
    reach = np.where(reached_end, max_range_m,
                     np.where(valid.any(axis=1), dists[last_valid], 0.0))
    return horizon.astype(np.float32), reach.astype(np.float32)
