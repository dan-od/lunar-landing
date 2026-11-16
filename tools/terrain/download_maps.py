"""Download the elevation maps in the catalogue into a target root.

Run once on the server to fill the maps Docker volume; safe to re-run. Each map
resumes where it left off (curl -C -) and is checked against the catalogue byte
size, so a half-downloaded file is never treated as complete. PDS maps also
fetch their .lbl label. Nothing is downloaded into git or an image.

  python download_maps.py /srv/moon-maps            # all maps
  python download_maps.py /srv/moon-maps LDEM_128   # one map by name
"""
import os
import subprocess
import sys

import maps


def label_url(entry: maps.MapEntry) -> str:
    # the label sits beside the .img at the source
    return entry.source_url.rsplit("/", 1)[0] + "/" + entry.label


def curl_resume(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print(f"  -> {url}")
    subprocess.run(
        ["curl", "-fL", "--retry", "3", "--retry-delay", "5", "-C", "-", "-o", dest, url],
        check=True,
    )


def fetch(entry: maps.MapEntry, root: str) -> bool:
    print(f"[{entry.name}] {entry.version}")
    dest = entry.path(root)
    if entry.label:
        curl_resume(label_url(entry), entry.label_path(root))
    curl_resume(entry.source_url, dest)

    actual = os.path.getsize(dest)
    if entry.byte_size is not None and actual != entry.byte_size:
        print(f"  !! size {actual} != catalogue {entry.byte_size}; incomplete, will resume next run")
        return False
    print(f"  ok {actual} bytes")
    return True


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    root = sys.argv[1]
    only = sys.argv[2] if len(sys.argv) > 2 else None
    cat = maps.Catalogue()
    entries = [cat.maps[only]] if only else cat.ordered()
    ok = True
    for e in entries:
        if not e.source_url:
            continue
        try:
            ok = fetch(e, root) and ok
        except subprocess.CalledProcessError as err:
            print(f"  !! download failed: {err}")
            ok = False
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
