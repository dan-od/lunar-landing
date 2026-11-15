"""Step 2: open the south-pole DEM and report what the file itself says.

Prints raster size, the projection details read from the file (not assumed),
and the elevation sampled at the IM-2 target (84.78 S, 29.13 E).

Nothing here is invented: every number comes from the GeoTIFF or from a
coordinate transform defined by the file's own CRS.
"""
import sys
import rasterio
from rasterio.transform import rowcol
from pyproj import CRS, Transformer

DEM_PATH = "../../data/LDEM_80S_80MPP_ADJ.TIF"
TEST_LAT = -84.78   # 84.78 S
TEST_LON = 29.13    # degrees east


def main():
    with rasterio.open(DEM_PATH) as ds:
        print("=== File ===")
        print("path          :", DEM_PATH)
        print("driver        :", ds.driver)
        print("size (w x h)  :", ds.width, "x", ds.height, "pixels")
        print("bands         :", ds.count, "dtype", ds.dtypes[0])
        print("nodata        :", ds.nodata)

        print("\n=== Projection (read from the file) ===")
        crs = ds.crs
        print("CRS string    :", crs.to_string() if crs else None)
        pc = CRS.from_user_input(crs) if crs else None
        if pc:
            print("CRS name      :", pc.name)
            print("WKT           :", pc.to_wkt())
        print("\ntransform     :", ds.transform)
        print("pixel size    :", ds.transform.a, "x", -ds.transform.e, "(units of the CRS)")
        b = ds.bounds
        print("bounds (CRS)  : left %.1f  bottom %.1f  right %.1f  top %.1f" %
              (b.left, b.bottom, b.right, b.top))

        # Geographic CRS on the same Moon ellipsoid as the projected CRS, so the
        # transform is self-consistent with the file rather than assuming a radius.
        geog = pc.geodetic_crs
        print("\ngeodetic CRS  :", geog.to_string())
        fwd = Transformer.from_crs(geog, pc, always_xy=True)
        x, y = fwd.transform(TEST_LON, TEST_LAT)
        print("\n=== Sample at 84.78 S, 29.13 E ===")
        print("projected x,y : %.3f, %.3f" % (x, y))
        row, col = rowcol(ds.transform, x, y)
        print("pixel row,col : %d, %d" % (row, col))
        if not (0 <= row < ds.height and 0 <= col < ds.width):
            print("!! point falls outside the raster -- stopping")
            sys.exit(1)
        val = ds.read(1)[row, col]
        print("raw value     :", val)
        scale = ds.scales[0]
        offset = ds.offsets[0]
        print("scale, offset :", scale, offset)
        elev_m = val * scale + offset
        print("elevation     : %.3f m (raw * scale + offset)" % elev_m)


if __name__ == "__main__":
    main()
