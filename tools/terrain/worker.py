"""Terrain worker: one job at a time, retried with backoff.

A separate container runs this against the shared Postgres. Each job computes a
site's horizon grid on the best downloaded map and stores it in horizon_profiles
with the map name and version. A job is skipped when a result already exists for
the same site, grid and map version, so re-runs are cheap. If no downloaded map
yet covers the site, the job waits and is retried, not failed.
"""
from __future__ import annotations

import os
import time

import psycopg
from psycopg.rows import dict_row

import compute
import maps

MAX_ATTEMPTS = 5
WAIT_FOR_MAP_S = 300          # retry delay when no map covers the site yet
POLL_IDLE_S = 5
DATA_ROOT = os.environ.get("TERRAIN_DATA_ROOT",
                           os.path.abspath(os.path.join(maps.HERE, "..", "..")))


def dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    host = os.environ.get("PGHOST", "127.0.0.1")
    port = os.environ.get("PGPORT", "5432")
    user = os.environ.get("PGUSER", "moon")
    pw = os.environ.get("PGPASSWORD", "moon")
    db = os.environ.get("PGDATABASE", "moon")
    return f"postgres://{user}:{pw}@{host}:{port}/{db}"


def backoff_seconds(attempts: int) -> int:
    return min(600, 5 * (2 ** attempts))


def enqueue_job(conn, site_id, lat, lon, step_m=40, half_m=400) -> int | None:
    """Queue a job unless the site already has an active one. Returns id or None."""
    row = conn.execute(
        """INSERT INTO terrain_jobs (site_id, latitude, longitude, step_m, half_m)
           SELECT %s, %s, %s, %s, %s
           WHERE NOT EXISTS (SELECT 1 FROM terrain_jobs
                             WHERE site_id = %s AND status IN ('queued','running'))
           RETURNING id""",
        [site_id, lat, lon, step_m, half_m, site_id],
    ).fetchone()
    conn.commit()
    return row["id"] if row else None


def claim_job(conn):
    """Claim the next ready job (FOR UPDATE SKIP LOCKED keeps it one at a time)."""
    row = conn.execute(
        """UPDATE terrain_jobs SET status='running', updated_at=now()
           WHERE id = (SELECT id FROM terrain_jobs
                       WHERE status='queued' AND run_after <= now()
                       ORDER BY run_after, id
                       FOR UPDATE SKIP LOCKED LIMIT 1)
           RETURNING id, site_id, latitude, longitude, step_m, half_m, attempts""",
    ).fetchone()
    conn.commit()
    return row


def _requeue(conn, job_id, attempts, error, delay_s):
    conn.execute(
        """UPDATE terrain_jobs
           SET status='queued', attempts=%s, last_error=%s,
               run_after = now() + make_interval(secs => %s), updated_at=now()
           WHERE id=%s""",
        [attempts, error, delay_s, job_id],
    )
    conn.commit()


def _finish(conn, job_id, status, map_name=None, map_version=None, error=None):
    conn.execute(
        """UPDATE terrain_jobs SET status=%s, map_name=%s, map_version=%s,
               last_error=%s, updated_at=now() WHERE id=%s""",
        [status, map_name, map_version, error, job_id],
    )
    conn.commit()


def _store(conn, job, doc):
    """Replace the site's profiles with the computed grid, with map provenance."""
    site = job["site_id"]
    with conn.transaction():
        conn.execute("DELETE FROM horizon_profiles WHERE site_id=%s", [site])
        for p in doc["points"]:
            conn.execute(
                """INSERT INTO horizon_profiles
                     (site_id, offset_east, offset_north, heights_deg, map_name, map_version)
                   VALUES (%s,%s,%s,%s::double precision[],%s,%s)""",
                [site, p["offset_east"], p["offset_north"], p["heights_deg"],
                 doc["map_name"], doc["map_version"]],
            )
        conn.execute(
            """INSERT INTO terrain_runs
                 (site_id, map_name, map_version, resolution_m, step_m, half_m, point_count, computed_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s, now())
               ON CONFLICT (site_id) DO UPDATE SET
                 map_name=EXCLUDED.map_name, map_version=EXCLUDED.map_version,
                 resolution_m=EXCLUDED.resolution_m, step_m=EXCLUDED.step_m,
                 half_m=EXCLUDED.half_m, point_count=EXCLUDED.point_count,
                 computed_at=EXCLUDED.computed_at""",
            [site, doc["map_name"], doc["map_version"], doc["resolution_m"],
             job["step_m"], job["half_m"], len(doc["points"])],
        )
        conn.execute("UPDATE sites SET has_terrain=TRUE WHERE id=%s", [site])


def process_one_job(conn, data_root=DATA_ROOT, cat: maps.Catalogue | None = None) -> dict:
    cat = cat or maps.Catalogue()
    job = claim_job(conn)
    if job is None:
        return {"outcome": "idle"}
    sid, lat, lon = job["site_id"], job["latitude"], job["longitude"]

    entry = maps.choose_map(cat, lon, lat, data_root)
    if entry is None:
        _requeue(conn, job["id"], job["attempts"],
                 "no downloaded map covers this site yet", WAIT_FOR_MAP_S)
        return {"outcome": "waiting", "site": sid}

    # skip rule: a result for this site, grid and map version already exists
    existing = conn.execute(
        """SELECT 1 FROM terrain_runs
           WHERE site_id=%s AND map_version=%s AND step_m=%s AND half_m=%s""",
        [sid, entry.version, job["step_m"], job["half_m"]],
    ).fetchone()
    if existing:
        _finish(conn, job["id"], "skipped", entry.name, entry.version)
        return {"outcome": "skipped", "site": sid, "map": entry.name}

    try:
        lm = maps.LoadedMap(entry, data_root, cat.radius_m)
        try:
            doc = compute.site_profile(lm, lon, lat, job["half_m"], job["step_m"],
                                       cat.radius_m, cat.ray_range_m)
        finally:
            lm.close()
        _store(conn, job, doc)
        _finish(conn, job["id"], "done", entry.name, entry.version)
        return {"outcome": "done", "site": sid, "map": entry.name,
                "version": entry.version, "points": len(doc["points"])}
    except Exception as err:  # noqa: BLE001 - record and retry/park
        attempts = job["attempts"] + 1
        if attempts >= MAX_ATTEMPTS:
            _finish(conn, job["id"], "error", entry.name, entry.version, str(err)[:500])
            return {"outcome": "error", "site": sid, "error": str(err)}
        _requeue(conn, job["id"], attempts, str(err)[:500], backoff_seconds(attempts))
        return {"outcome": "retry", "site": sid, "attempts": attempts}


def main() -> None:
    cat = maps.Catalogue()
    print(f"terrain worker: data_root={DATA_ROOT}")
    with psycopg.connect(dsn(), row_factory=dict_row, autocommit=False) as conn:
        while True:
            try:
                res = process_one_job(conn, DATA_ROOT, cat)
            except Exception as err:  # keep the loop alive
                print("worker error:", err)
                conn.rollback()
                res = {"outcome": "loop-error"}
            if res["outcome"] == "idle":
                time.sleep(POLL_IDLE_S)
            else:
                print("job:", res)


if __name__ == "__main__":
    main()
