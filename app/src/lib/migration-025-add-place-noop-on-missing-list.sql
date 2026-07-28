-- Migration 025: Trip Planning M2 Wk3 — add_place_to_list no-ops on a missing list
--
-- Approved hardening from the B11 ghost-trip incident (2026-07-22): a queued
-- place_add referencing a list the server never had (client-only "ghost", or a
-- list deleted before the queue drained) used to FK-error. The client now drops
-- permanent data errors immediately (write-queue fix, commit 8c8dd79), but this
-- kills the class at the source: adding to a nonexistent list returns cleanly,
-- exactly like the already-idempotent duplicate-add case. The client-side drop
-- logic stays as defense-in-depth.
--
-- SECURITY INVOKER + RLS note: the existence check reads saved_lists under the
-- caller's RLS, so "someone else's list" is indistinguishable from "no list" —
-- both no-op, which is the correct (non-leaking) behaviour.
--
-- Run in the Supabase SQL Editor (no migration runner). Idempotent — safe to
-- re-run (CREATE OR REPLACE).
--
-- NUMBERING: 024 (trip RPCs) confirmed as the latest applied before assigning
-- this file. The M4 share model moves to migration 026.

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
  -- No-op when the target list doesn't exist (for this caller, per RLS).
  IF NOT EXISTS (SELECT 1 FROM saved_lists WHERE id = p_list_id) THEN
    RETURN;
  END IF;

  INSERT INTO saved_list_places (list_id, place_id, position, added_at)
  VALUES (
    p_list_id,
    p_place_id,
    coalesce((SELECT max(position) FROM saved_list_places WHERE list_id = p_list_id), -1000) + 1000,
    p_added_at
  )
  ON CONFLICT (list_id, place_id) DO NOTHING;
END $$;
