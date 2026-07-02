-- Migration 024: Trip Planning M1 Wk2 — default-trip + add-place RPCs
--
-- Wk2 wires "Save to a trip" on place detail. Two writes need to be atomic /
-- server-computed, so they're RPCs (called through the offline write-queue like
-- any other write); both SECURITY INVOKER so RLS scopes them to the caller.
--
-- Run in the Supabase SQL Editor (no migration runner). Idempotent — safe to
-- re-run (CREATE OR REPLACE). Must be live before the Wk2 build is tested,
-- since the preview build shares this (production) Supabase project.

-- 1) Default-trip auto-create. Clears any existing default, then sets the new
--    list as the one default — in a single statement-pair inside the function
--    body (one implicit transaction) so the one-default-per-user partial unique
--    index (saved_lists_one_default_per_user) never trips mid-operation.
--    Idempotent on the client-supplied UUID (ON CONFLICT). Title = the user's
--    first city (clamped to the 80-char CHECK; user-renameable afterwards).
--    Bypasses the soft 10-list cap — the cap is a client-side guard on manual
--    creation only; a first save must never be blocked.
CREATE OR REPLACE FUNCTION set_default_trip(p_list_id uuid, p_title text)
RETURNS saved_lists
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  r saved_lists;
BEGIN
  UPDATE saved_lists SET is_default = false
    WHERE user_id = auth.uid() AND is_default;

  INSERT INTO saved_lists (id, user_id, name, is_default)
  VALUES (
    p_list_id,
    auth.uid(),
    left(coalesce(nullif(btrim(p_title), ''), 'My Trip'), 80),
    true
  )
  ON CONFLICT (id) DO UPDATE SET is_default = true
  RETURNING * INTO r;

  RETURN r;
END $$;

-- 2) Add a place to a list at the next 1000-step position, idempotent on the
--    (list_id, place_id) PK. Position is computed server-side from the current
--    max so offline replays land in insertion order without a racy client read
--    and without needing the list's contents cached on the client. RLS on
--    saved_list_places (owner-only via saved_lists.user_id) scopes both the max
--    subquery and the insert to the caller's own rows.
CREATE OR REPLACE FUNCTION add_place_to_list(
  p_list_id uuid,
  p_place_id uuid,
  p_added_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO saved_list_places (list_id, place_id, position, added_at)
  VALUES (
    p_list_id,
    p_place_id,
    coalesce((SELECT max(position) FROM saved_list_places WHERE list_id = p_list_id), -1000) + 1000,
    p_added_at
  )
  ON CONFLICT (list_id, place_id) DO NOTHING;
END $$;
