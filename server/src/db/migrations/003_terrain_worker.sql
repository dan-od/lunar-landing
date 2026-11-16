-- Terrain worker: a job queue, and map provenance on every stored profile.
-- Any site inside a downloaded map gets a real horizon profile, computed once
-- per (site, grid, map version) and kept until the map version changes.

-- Which map (name and version) produced each stored profile row. Nullable so
-- the migration applies to a live database; the loader and worker always set
-- them. Existing rows were all built from the 80 m south map.
ALTER TABLE horizon_profiles ADD COLUMN IF NOT EXISTS map_name    TEXT;
ALTER TABLE horizon_profiles ADD COLUMN IF NOT EXISTS map_version TEXT;
UPDATE horizon_profiles
   SET map_name = 'LDEM_80S_80MPP', map_version = 'ADJ-2015'
 WHERE map_name IS NULL;

-- One row per site that has prepared terrain: the map, version and grid that
-- produced its current profiles. Drives the skip rule and the "names the map"
-- API, and is replaced whenever a site is recomputed.
CREATE TABLE IF NOT EXISTS terrain_runs (
  site_id      TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  map_name     TEXT NOT NULL,
  map_version  TEXT NOT NULL,
  resolution_m DOUBLE PRECISION NOT NULL,   -- the map's resolution, for the UI
  step_m       INTEGER NOT NULL,            -- grid spacing
  half_m       INTEGER NOT NULL,            -- grid reach east and north
  point_count  INTEGER NOT NULL,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The job queue. One job at a time is claimed with FOR UPDATE SKIP LOCKED.
CREATE TABLE IF NOT EXISTS terrain_jobs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  step_m       INTEGER NOT NULL DEFAULT 40,
  half_m       INTEGER NOT NULL DEFAULT 400,
  map_name     TEXT,          -- filled by the worker once it chooses a map
  map_version  TEXT,
  status       TEXT NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','running','done','error','skipped','blocked')),
  attempts     INTEGER NOT NULL DEFAULT 0,   -- failed attempts, for backoff
  run_after    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one active (queued or running) job per site, so a flurry of triggers
-- cannot pile up duplicate work.
CREATE UNIQUE INDEX IF NOT EXISTS terrain_jobs_one_active
  ON terrain_jobs (site_id) WHERE status IN ('queued', 'running');

-- Claiming scans by status then readiness.
CREATE INDEX IF NOT EXISTS terrain_jobs_claim
  ON terrain_jobs (status, run_after);

-- Rate-limit ledger for terrain jobs a visitor triggers (5 per hour, S/7-style).
CREATE TABLE IF NOT EXISTS terrain_job_requests (
  owner_session TEXT NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS terrain_job_requests_session
  ON terrain_job_requests (owner_session, requested_at);
