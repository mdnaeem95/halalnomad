-- Migration 018: fix increment_verification (SECURITY DEFINER) + backfill
--
-- BUG: increment_verification() was created without SECURITY DEFINER, so it
-- ran with the *caller's* privileges. The places UPDATE policy is
-- "Place owners can update" (auth.uid() = added_by), so when a user who is
-- NOT the place's creator confirmed a place, the
--   UPDATE places SET verification_count = verification_count + 1 ...
-- matched 0 rows under RLS — and an UPDATE that affects 0 rows raises NO
-- error. The verification row inserted fine (verifications allows any authed
-- user), but the count silently never moved. The client call site
-- (services/places.ts) doesn't error-check the RPC, so nothing surfaced.
--
-- This is the same class of bug migration-011 fixed for the notification
-- triggers. Its sibling increment_report_count was already SECURITY DEFINER
-- with search_path=public (so reports worked) — increment_verification was
-- the one that got missed in the original schema.sql.
--
-- Impact at time of writing: 19 places undercounted (19 dropped confirms),
-- 0 missed halal_level upgrades (none had reached the >=3 threshold).
--
-- Fix = harden the function to match increment_report_count, then backfill
-- verification_count + last_verified_at from the source of truth
-- (the verifications table) and apply any upgrades the >=3 rule would have.

-- 1) Harden the function: run as owner (bypass RLS), pin search_path.
create or replace function increment_verification(p_place_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update places
  set verification_count = verification_count + 1,
      last_verified_at = now()
  where id = p_place_id
  returning verification_count into v_count;

  if v_count >= 3 then
    update places set halal_level = greatest(halal_level, 2) where id = p_place_id;
  end if;
end;
$$;

-- 2) Backfill: reconcile counts with the actual approved confirm rows.
update places p
set verification_count = a.c,
    last_verified_at   = a.last_at
from (
  select place_id, count(*) as c, max(created_at) as last_at
  from verifications
  where type = 'confirm' and status = 'approved'
  group by place_id
) a
where a.place_id = p.id
  and (p.verification_count <> a.c
       or p.last_verified_at is distinct from a.last_at);

-- 3) Apply any auto-upgrades that were missed while the count was stuck.
update places
set halal_level = greatest(halal_level, 2)
where verification_count >= 3 and halal_level < 2;
