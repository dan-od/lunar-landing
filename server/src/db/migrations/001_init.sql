-- Moon Status initial schema. Tables mirror the data model in docs/PRD.md.

-- Curated and custom landing sites.
CREATE TABLE IF NOT EXISTS sites (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  short         TEXT NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,   -- degrees; negative is south
  longitude     DOUBLE PRECISION NOT NULL,   -- degrees east
  height_km     DOUBLE PRECISION NOT NULL DEFAULT 0,
  source        TEXT NOT NULL,               -- F-5: every site cites a source
  has_terrain   BOOLEAN NOT NULL DEFAULT FALSE,
  owner_session TEXT,                         -- set for custom sites only
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cached NASA Horizons replies: one row per site, body and hour (F-3).
CREATE TABLE IF NOT EXISTS position_cache (
  site_id       TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  body          TEXT NOT NULL CHECK (body IN ('sun', 'earth')),
  time          TIMESTAMPTZ NOT NULL,
  azimuth_deg   DOUBLE PRECISION NOT NULL,   -- degrees clockwise from north
  elevation_deg DOUBLE PRECISION NOT NULL,   -- degrees above the horizon
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, body, time)
);

-- Terrain horizon profiles: 360 heights per grid point around a site.
CREATE TABLE IF NOT EXISTS horizon_profiles (
  site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  offset_east  INTEGER NOT NULL,             -- metres east of the target
  offset_north INTEGER NOT NULL,             -- metres north of the target
  heights_deg  DOUBLE PRECISION[] NOT NULL,  -- 360 values, index = degrees clockwise from north
  PRIMARY KEY (site_id, offset_east, offset_north)
);

-- Alert requests.
CREATE TABLE IF NOT EXISTS watches (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  scenario        JSONB NOT NULL,
  rule            TEXT NOT NULL,
  address         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  token_hash      TEXT,
  token_expiry    TIMESTAMPTZ,
  manage_link_hash TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Watch event log.
CREATE TABLE IF NOT EXISTS events (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  watch_id  BIGINT NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  level     TEXT NOT NULL,
  message   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_watch_id_idx ON events(watch_id);
