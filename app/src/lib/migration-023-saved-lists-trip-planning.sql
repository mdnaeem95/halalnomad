-- Migration 023: Trip Planning foundation — saved_lists + saved_list_places join
--
-- Prepares the schema for the Trip Planning feature (build kickoff the week
-- of 2026-06-22). `saved_lists` has no UI consumer yet, so this is a pure
-- schema reshape with no behaviour change. Fixes four issues with the
-- pre-existing shape:
--   1. Denormalized `place_ids uuid[]` can't carry per-place position/added_at/
--      day, and concurrent edits clobber the whole array.
--      -> migrate to a `saved_list_places` join table.
--   2. `day_index` was list-level (one day per whole list). Trip Planning needs
--      per-place-per-list day assignment.  -> move it onto the join.
--   3. Owner RLS policy was `FOR ALL USING (...)` with no `WITH CHECK`, so a
--      user could write a row with someone else's user_id.  -> add WITH CHECK.
--   4. `is_shared` + its broad SELECT policy exposed a list to ANY authed user.
--      No sharing UI exists; the real share model lands later via a per-list
--      token.  -> drop both now.
--
-- HOW TO RUN (Supabase SQL Editor — no migration runner in this project):
--   1. Run the read-only orphan pre-flight first (see Step 0 below). If it
--      returns >0, note the count: the backfill's INNER JOIN silently drops
--      those orphan place_ids — they must not shed unrecorded.
--   2. Run this whole block. It ends in ROLLBACK, so nothing is permanent.
--   3. Review the two post-flight reports (saved_lists columns + join row count).
--   4. Change the final `ROLLBACK;` to `COMMIT;` and re-run to make it permanent.
--
-- As of 2026-06-23 `saved_lists` is empty (0 rows), so the backfill moves 0
-- rows — expected. The migration's real job is creating the join table + the
-- schema the Trip Planning build needs.

-- ---------------------------------------------------------------------------
-- Step 0 — orphan pre-flight (read-only; run on its own BEFORE the block below)
-- ---------------------------------------------------------------------------
-- select count(*) as orphan_count
-- from saved_lists sl
-- cross join lateral unnest(sl.place_ids) as pid(place_id)
-- left join places p on p.id = pid.place_id
-- where p.id is null;

-- ---------------------------------------------------------------------------
-- The migration
-- ---------------------------------------------------------------------------
BEGIN;

-- name length ceiling
ALTER TABLE saved_lists ADD CONSTRAINT saved_lists_name_len CHECK (char_length(name) <= 80);

-- updated_at (bump trigger, never client-set) + is_default (one default per user)
ALTER TABLE saved_lists
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN is_default BOOLEAN     NOT NULL DEFAULT false;
CREATE UNIQUE INDEX saved_lists_one_default_per_user ON saved_lists (user_id) WHERE is_default;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER saved_lists_set_updated_at BEFORE UPDATE ON saved_lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- join table — place_id FK ON DELETE CASCADE stops the orphan recurrence
CREATE TABLE saved_list_places (
  list_id   UUID NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
  place_id  UUID NOT NULL REFERENCES places(id)      ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  position  INTEGER NOT NULL,
  day_index INTEGER,                       -- nullable = unassigned
  PRIMARY KEY (list_id, place_id)
);
CREATE INDEX saved_list_places_list_pos ON saved_list_places (list_id, position);

-- backfill arrays → rows; INNER JOIN drops orphans (counted in Step 0). added_at = list created_at.
INSERT INTO saved_list_places (list_id, place_id, position, added_at)
SELECT sl.id, pid.place_id, (pid.ord - 1) * 1000, sl.created_at
FROM saved_lists sl
CROSS JOIN LATERAL unnest(sl.place_ids) WITH ORDINALITY AS pid(place_id, ord)
JOIN places p ON p.id = pid.place_id;

-- RLS — DROP the is_shared-referencing policy BEFORE dropping the column (Postgres rejects the other order)
DROP POLICY IF EXISTS "Shared lists are viewable" ON saved_lists;
DROP POLICY IF EXISTS "Users can manage own lists" ON saved_lists;
CREATE POLICY "owner manage lists" ON saved_lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE saved_list_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage list places" ON saved_list_places FOR ALL
  USING      (EXISTS (SELECT 1 FROM saved_lists sl WHERE sl.id = list_id AND sl.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM saved_lists sl WHERE sl.id = list_id AND sl.user_id = auth.uid()));

-- now safe to drop columns (the policy referencing is_shared is gone)
ALTER TABLE saved_lists DROP COLUMN place_ids, DROP COLUMN day_index, DROP COLUMN is_shared;

-- post-flight: confirm shape before committing
SELECT 'saved_lists columns' AS report;
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'saved_lists' ORDER BY ordinal_position;
SELECT 'join table row count (expect = sum of old array lengths, minus any orphans)' AS report;
SELECT count(*) FROM saved_list_places;

ROLLBACK;  -- review the two reports, then change to COMMIT and re-run
