-- Watch by email (flow 5). Adds what the watch and events tables from 001 need
-- for confirmation, checking and the alert cap. Safe to run more than once.
--
-- Column use (see server/src/watch/repo.ts):
--   status            'pending' (waiting), 'expired' (link ran out), 'active' (holding), 'tripped' (broken)
--   token_hash        keyed hash of the single-use confirmation token; NULL once used
--   token_expiry      when that link stops working (24 hours after it is issued)
--   manage_link_hash  keyed hash of the private manage token
-- No token is ever stored in the clear.

ALTER TABLE watches ADD COLUMN IF NOT EXISTS confirmed_at       TIMESTAMPTZ;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS last_checked_at    TIMESTAMPTZ;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT now();
-- At most 5 alert emails per watch in 24 hours: the window's start and the count in it.
ALTER TABLE watches ADD COLUMN IF NOT EXISTS alert_window_start TIMESTAMPTZ;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS alert_count        INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS watches_manage_link_hash_idx ON watches (manage_link_hash);
CREATE INDEX IF NOT EXISTS watches_token_hash_idx ON watches (token_hash);
CREATE INDEX IF NOT EXISTS watches_address_idx ON watches (lower(address));
CREATE INDEX IF NOT EXISTS watches_status_idx ON watches (status);
