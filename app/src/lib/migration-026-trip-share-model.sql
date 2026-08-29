-- Migration 026: Trip Planning M4 — share model (read-only link).
-- The reserved 026 slot (see CLAUDE.md). NOTE ON NUMBERING: 027 (cert
-- provenance) was created + applied 2026-08-09 while 026 stayed reserved for
-- this. 026 touches `saved_lists` only, 027 touched `places` only — disjoint,
-- so applying 026 after 027 is safe and order-independent. Pre-flight below
-- confirms the expected state before you commit.
--
-- Design (locked June 2026, all four Sani confirmations):
--   * A trip becomes shareable via an unguessable per-list token.
--   * visibility is 'private' (default) or 'unlisted' — 'public' was CUT
--     (Sani, 2026-06-12); do NOT add it. "unlisted" = reachable by link only,
--     never discoverable or queryable.
--   * Shared reads go through a SECURITY DEFINER RPC keyed by the token — NOT a
--     broad RLS policy. Wrong token / private / revoked all return nothing.
--   * Token generation enforces title moderation (Q2): a denylisted title is
--     refused (clear error → rename to share); the shared *display* title is
--     capped at 60 chars.
--   * Author display name is shown on the shared view by default (Q3).
--
-- HOW TO RUN (Supabase SQL Editor — no migration runner in this project):
--   1. Run the read-only pre-flight (Step 0) on its own first.
--   2. Run the whole block — it ends in ROLLBACK, nothing is permanent.
--   3. Review the post-flight report at the bottom.
--   4. Change the final ROLLBACK to COMMIT and re-run to make it permanent.

-- ---------------------------------------------------------------------------
-- Step 0 — pre-flight (read-only; run BEFORE the block below)
-- ---------------------------------------------------------------------------
-- Expect: share_token / visibility / last_shared_at do NOT yet exist on
-- saved_lists (026 not applied), and cert_body DOES exist on places (027 is).
-- select
--   (select count(*) from information_schema.columns
--     where table_name='saved_lists' and column_name in ('share_token','visibility','last_shared_at')) as share_cols_present, -- expect 0
--   (select count(*) from information_schema.columns
--     where table_name='places' and column_name='cert_body') as cert_applied;  -- expect 1

-- ---------------------------------------------------------------------------
-- The migration
-- ---------------------------------------------------------------------------
BEGIN;

-- 1) Columns on saved_lists (additive; all nullable / defaulted) --------------
ALTER TABLE saved_lists
  ADD COLUMN IF NOT EXISTS share_token    UUID,
  ADD COLUMN IF NOT EXISTS visibility     TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS last_shared_at TIMESTAMPTZ;

-- visibility is a closed set; 'public' is deliberately absent.
ALTER TABLE saved_lists
  ADD CONSTRAINT saved_lists_visibility_chk CHECK (visibility IN ('private', 'unlisted'));

-- One token → one list. Partial unique index (only where a token exists) so the
-- default NULL doesn't collide across every private list.
CREATE UNIQUE INDEX IF NOT EXISTS saved_lists_share_token_uniq
  ON saved_lists (share_token) WHERE share_token IS NOT NULL;

-- 2) Title moderation denylist (Q2) ------------------------------------------
-- Deliberately conservative + reviewable. A shared title is public-by-link, so
-- refuse obviously-abusive text. Word-boundary, case-insensitive match so
-- "Scunthorpe"-class false positives are avoided. The list is INLINE (not a
-- separate table) so the function has no cross-object dependency — a brand-new
-- RLS-less public table was both fragile to create-time validation and an
-- unprotected-table smell in Supabase. Expand via a follow-up migration; if it
-- ever needs to be editable without a migration, promote it to a table in v1.1.
CREATE OR REPLACE FUNCTION share_title_is_allowed(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(ARRAY['fuck','shit','bitch','cunt','nigger','faggot','retard']) AS term
    WHERE lower(p_name) ~ ('\m' || term || '\M')
  );
$$;

-- 3) generate_share_token — owner-only, enforces moderation -------------------
-- SECURITY INVOKER: operates on the caller's own list under RLS (auth.uid()).
-- Idempotent: first call mints a token + flips to 'unlisted'; later calls reuse
-- the token and re-flip 'unlisted' (so re-sharing after a revoke just works).
-- Refuses a denylisted title with a distinct error the client maps to a
-- "rename to share" prompt — never silently.
CREATE OR REPLACE FUNCTION generate_share_token(p_list_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name  text;
  v_token uuid;
BEGIN
  SELECT name, share_token INTO v_name, v_token
    FROM saved_lists
   WHERE id = p_list_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'list not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT share_title_is_allowed(v_name) THEN
    -- distinct code so the client shows the rename prompt, not a generic error
    RAISE EXCEPTION 'share title blocked' USING ERRCODE = 'check_violation';
  END IF;

  v_token := COALESCE(v_token, gen_random_uuid());

  UPDATE saved_lists
     SET share_token    = v_token,
         visibility     = 'unlisted',
         last_shared_at = now()
   WHERE id = p_list_id AND user_id = auth.uid();

  RETURN v_token;
END $$;

-- 4) get_shared_trip — token-gated read for viewers (SECURITY DEFINER) --------
-- The ONLY path to a shared trip. Returns nothing unless the list is 'unlisted'
-- AND the token matches — so a wrong token, a private (revoked) list, or a
-- guessed id all yield nothing. Runs as owner (DEFINER) to bypass RLS for the
-- anonymous/other-user viewer; the token check IS the authorization.
-- Display title capped at 60 (Q2). Author display name shown by default (Q3).
CREATE OR REPLACE FUNCTION get_shared_trip(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_list   saved_lists;
  v_result jsonb;
BEGIN
  SELECT * INTO v_list
    FROM saved_lists
   WHERE share_token = p_token AND visibility = 'unlisted';

  IF NOT FOUND THEN
    RETURN NULL;  -- wrong token, private, or revoked → nothing
  END IF;

  SELECT jsonb_build_object(
    'list', jsonb_build_object(
      'id',            v_list.id,
      'name',          left(v_list.name, 60),
      'author',        (SELECT display_name FROM profiles WHERE id = v_list.user_id),
      'last_shared_at', v_list.last_shared_at
    ),
    'places', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(p) || jsonb_build_object('position', slp.position, 'day_index', slp.day_index)
        ORDER BY slp.day_index NULLS LAST, slp.position
      )
      FROM saved_list_places slp
      JOIN places p ON p.id = slp.place_id
      WHERE slp.list_id = v_list.id AND p.is_active
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $$;

-- 5) Grants -------------------------------------------------------------------
-- Viewers may be unauthenticated → get_shared_trip is callable by anon.
-- Token generation is owner-only → authenticated only.
REVOKE ALL ON FUNCTION get_shared_trip(uuid) FROM public;
GRANT EXECUTE ON FUNCTION get_shared_trip(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION generate_share_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION generate_share_token(uuid) TO authenticated;

-- Revoke = the owner sets visibility='private' via the normal owner RLS UPDATE
-- (token retained for re-share); no RPC needed. get_shared_trip then returns
-- nothing for that token until it's flipped back to 'unlisted'.

-- ---------------------------------------------------------------------------
-- Post-flight report
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name='saved_lists' AND column_name IN ('share_token','visibility','last_shared_at')) AS share_cols,        -- expect 3
  (SELECT count(*) FROM information_schema.table_constraints
    WHERE table_name='saved_lists' AND constraint_name='saved_lists_visibility_chk') AS visibility_chk,                    -- expect 1
  (SELECT count(*) FROM pg_proc WHERE proname IN ('generate_share_token','get_shared_trip','share_title_is_allowed')) AS rpcs, -- expect 3
  share_title_is_allowed('Tokyo halal trip') AS clean_ok,   -- expect TRUE
  share_title_is_allowed('my shit trip')     AS bad_blocked; -- expect FALSE

-- Flip to COMMIT once the report reads 3 / 1 / 3 / t / f.
ROLLBACK;
