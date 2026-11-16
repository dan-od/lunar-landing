"""Compute horizon profiles offline for every built-in site that has none yet.

Each site uses the best map that covers it with the full 150 km ray range
inside it (same grid as the demo site). Writes one <site>_terrain.json per site,
in the shape the loader reads, recording the map name and resolution. Never
writes an empty profile: a site no map covers is reported and skipped.
"""
import json
import os
import re
import sys
import time

import compute
import maps

DATA_ROOT = os.environ.get("TERRAIN_DATA_ROOT", "/Users/ds/Codes/nasa")
SITES_TS = os.path.join(maps.HERE, "../../core/src/sites.ts")
HALF_M, STEP_M = 400, 40
HEIGHT_DECIMALS = 4

SITE_RE = re.compile(
    r"id:\s*'([^']+)'.*?name:\s*([\"'])(.*?)\2.*?lat:\s*(-?[\d.]+).*?lon:\s*(-?[\d.]+).*?hasTerrain:\s*(true|false)",
    re.S,
)


def read_sites():
    src = open(SITES_TS).read()
    out = []
    for m in SITE_RE.finditer(src):
        out.append({"id": m.group(1), "name": m.group(3),
                    "lat": float(m.group(4)), "lon": float(m.group(5)),
                    "has_terrain": m.group(6) == "true"})
    return out


def build(cat, site):
    entry = maps.choose_map(cat, site["lon"], site["lat"], DATA_ROOT)
    if entry is None:
        return None, None
    lm = maps.LoadedMap(entry, DATA_ROOT, cat.radius_m)
    try:
        doc = compute.site_profile(lm, site["lon"], site["lat"], HALF_M, STEP_M,
                                   cat.radius_m, cat.ray_range_m, HEIGHT_DECIMALS)
    finally:
        lm.close()
    doc["site_id"] = site["id"]
    doc["site_name"] = site["name"]
    return entry, doc


def main():
    only = set(sys.argv[1:])
    cat = maps.Catalogue()
    sites = [s for s in read_sites() if not s["has_terrain"]]
    if only:
        sites = [s for s in sites if s["id"] in only]
    print(f"computing {len(sites)} site(s), grid +/-{HALF_M} m step {STEP_M} m\n")
    skipped = []
    for s in sites:
        t0 = time.perf_counter()
        entry, doc = build(cat, s)
        if doc is None:
            skipped.append(s["id"])
            print(f"{s['id']:10s} SKIPPED: no downloaded map covers it")
            continue
        out = os.path.join(maps.HERE, f"{s['id']}_terrain.json")
        with open(out, "w") as fh:
            json.dump(doc, fh, separators=(",", ":"))
            fh.write("\n")
        size = os.path.getsize(out)
        print(f"{s['id']:10s} map={entry.name:14s} {entry.resolution_m:3.0f}m  "
              f"{len(doc['points'])} pts  {time.perf_counter()-t0:4.1f}s  {size/1e6:.2f}MB")
    print(f"\ndone: {len(sites) - len(skipped)} written, {len(skipped)} skipped {skipped or ''}")
    if skipped:
        sys.exit(1)


if __name__ == "__main__":
    main()
