"""Integration tests for the terrain worker against a real Postgres.

Set DATABASE_URL to a throwaway database with the migrations applied, e.g.
  DATABASE_URL=postgres://moon:moon@127.0.0.1:55433/moon_test ./.venv/bin/python test_worker.py
Skips cleanly (exit 0) when no DATABASE_URL is set, so it never blocks.
"""
import os
import sys

DB = os.environ.get("DATABASE_URL")
if not DB:
    print("skip worker tests: DATABASE_URL not set")
    sys.exit(0)

import psycopg
from psycopg.rows import dict_row

import worker

DATA_ROOT = os.path.abspath(os.path.join(worker.maps.HERE, "..", ".."))


def conn():
    return psycopg.connect(DB, row_factory=dict_row, autocommit=False)


def reset(c):
    c.execute("TRUNCATE terrain_jobs, terrain_runs, horizon_profiles, terrain_job_requests RESTART IDENTITY CASCADE")
    c.execute("DELETE FROM sites WHERE id IN ('im2','nomapsite','other')")
    c.execute("UPDATE sites SET has_terrain=FALSE")
    c.commit()


def seed_site(c, sid, name, lat, lon):
    c.execute(
        """INSERT INTO sites (id, name, short, latitude, longitude, source)
           VALUES (%s,%s,%s,%s,%s,'test') ON CONFLICT (id) DO UPDATE
           SET latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude""",
        [sid, name, name[:8], lat, lon],
    )
    c.commit()


def test_enqueue_dedupes_active(c):
    seed_site(c, "im2", "IM-2", -84.78, 29.13)
    a = worker.enqueue_job(c, "im2", -84.78, 29.13, step_m=40, half_m=80)
    b = worker.enqueue_job(c, "im2", -84.78, 29.13, step_m=40, half_m=80)
    assert a is not None and b is None, (a, b)
    print("ok enqueue dedupes an active job")


def test_process_done_then_skip(c):
    # a job is queued for im2 from the previous test; run it
    res = worker.process_one_job(c, DATA_ROOT)
    assert res["outcome"] == "done", res
    assert res["map"] == "LDEM_80S_80MPP" and res["points"] == 25, res
    rows = c.execute("SELECT count(*) n, min(map_name) m, min(map_version) v FROM horizon_profiles WHERE site_id='im2'").fetchone()
    assert rows["n"] == 25 and rows["m"] == "LDEM_80S_80MPP" and rows["v"] == "ADJ-2015", rows
    run = c.execute("SELECT * FROM terrain_runs WHERE site_id='im2'").fetchone()
    assert run["map_name"] == "LDEM_80S_80MPP" and run["point_count"] == 25, run
    ht = c.execute("SELECT has_terrain FROM sites WHERE id='im2'").fetchone()
    assert ht["has_terrain"] is True
    print("ok worker computes and stores with map provenance:", res)

    # same site, grid and version again -> skipped
    worker.enqueue_job(c, "im2", -84.78, 29.13, step_m=40, half_m=80)
    res2 = worker.process_one_job(c, DATA_ROOT)
    assert res2["outcome"] == "skipped", res2
    print("ok skip rule: identical (site, grid, version) is skipped")


def test_waiting_when_no_map(c):
    seed_site(c, "nomapsite", "Equator", 45.0, 0.0)   # only global covers it; it is incomplete
    worker.enqueue_job(c, "nomapsite", 45.0, 0.0, step_m=40, half_m=80)
    res = worker.process_one_job(c, DATA_ROOT)
    assert res["outcome"] == "waiting", res
    job = c.execute("SELECT status, run_after > now() AS later, last_error FROM terrain_jobs WHERE site_id='nomapsite'").fetchone()
    assert job["status"] == "queued" and job["later"] is True, job
    print("ok no-map job waits and is retried later:", job["last_error"])


def test_one_at_a_time(c):
    # two different sites queued and ready; each claim takes exactly one
    c.execute("TRUNCATE terrain_jobs RESTART IDENTITY")
    c.commit()
    seed_site(c, "other", "Shackleton", -89.684, 196.739)
    worker.enqueue_job(c, "im2", -84.78, 29.13, step_m=40, half_m=80)
    worker.enqueue_job(c, "other", -89.684, 196.739, step_m=40, half_m=80)
    j1 = worker.claim_job(c)
    j2 = worker.claim_job(c)
    j3 = worker.claim_job(c)
    claimed = [j for j in (j1, j2, j3) if j]
    ids = {j["site_id"] for j in claimed}
    assert len(claimed) == 2 and ids == {"im2", "other"} and j3 is None, claimed
    running = c.execute("SELECT count(*) n FROM terrain_jobs WHERE status='running'").fetchone()["n"]
    assert running == 2
    print("ok claim takes one ready job at a time (2 queued -> 2 claimed, 3rd empty)")


def main():
    with conn() as c:
        reset(c)
        test_enqueue_dedupes_active(c)
        test_process_done_then_skip(c)
        test_waiting_when_no_map(c)
        test_one_at_a_time(c)
        reset(c)
    print("\nall worker integration tests passed")


if __name__ == "__main__":
    main()
