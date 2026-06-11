-- Migration 021: profile engagement counters for analytics identity
--
-- The PostHog person profile (identify) and super-/user-properties wiring
-- (see lib/analytics.ts, the Jun 2026 instrumentation bundle) wants a
-- per-user engagement snapshot:
--
--   total_verifications, total_reviews, total_places_added, cities_contributed,
--   total_sessions, total_days_active
--
-- None of these existed on `profiles` (only `points` -> tier, and
-- `last_active_at` from migration 006). Rather than recompute them with N
-- count() queries on every identify(), we maintain them as columns:
--
--   * The four CONTRIBUTION counters are server-derivable from the source
--     tables and are kept in sync by AFTER INSERT triggers + a one-time
--     backfill. They are the source of truth going forward.
--   * The two SESSION counters cannot be derived from existing data (we
--     have no per-session event log), so they are bumped by record_session()
--     which the client calls once per app-open. They backfill to 0 and
--     accumulate forward — historical sessions are unrecoverable.
--
-- Counter definitions (locked here so the events stay stable — renaming a
-- fired property is expensive):
--   total_places_added  = count(places.added_by = user)          [any is_active]
--   total_verifications = count(verifications: type='confirm' AND status='approved')
--                         -- parallels places.verification_count semantics;
--                         -- pending certificates are NOT counted
--   total_reviews       = count(reviews.user_id = user)
--   cities_contributed     = count(DISTINCT city) over places the user ADDED
--                         OR CONFIRMED, where city IS NOT NULL
--   total_sessions      = client-incremented per app-open (record_session)
--   total_days_active   = client-incremented when app-open crosses into a
--                         new calendar day vs last_active_at
--
-- All trigger/RPC functions are SECURITY DEFINER with search_path=public.
-- This is the lesson from migrations 011 and 018: a function that UPDATEs
-- an RLS-locked table while running as the *caller* can silently match 0
-- rows (UPDATE-affects-0-rows raises no error), and the counter just never
-- moves. Run as owner to bypass RLS deterministically.

-- ============================================
-- 1) Columns
-- ============================================
alter table profiles add column if not exists total_verifications integer not null default 0;
alter table profiles add column if not exists total_reviews        integer not null default 0;
alter table profiles add column if not exists total_places_added   integer not null default 0;
alter table profiles add column if not exists cities_contributed      integer not null default 0;
alter table profiles add column if not exists total_sessions       integer not null default 0;
alter table profiles add column if not exists total_days_active    integer not null default 0;

-- ============================================
-- 2) Shared recompute helper for cities_contributed
-- ============================================
-- cities_contributed is the only counter that isn't a flat increment (a user
-- can add/confirm several places in the same city). Recompute it from
-- scratch for one user — cheap at our scale, and immune to drift.
create or replace function recompute_cities_contributed(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
  set cities_contributed = (
    select count(distinct city)
    from (
      select pl.city
      from places pl
      where pl.added_by = p_user_id and pl.city is not null
      union
      select pl.city
      from places pl
      join verifications v on v.place_id = pl.id
      where v.user_id = p_user_id
        and v.type = 'confirm'
        and v.status = 'approved'
        and pl.city is not null
    ) c
  )
  where id = p_user_id;
$$;

-- ============================================
-- 3) Maintenance triggers
-- ============================================

-- places: a new contribution increments total_places_added and may add a city.
create or replace function bump_places_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.added_by is not null then
    update profiles set total_places_added = total_places_added + 1 where id = new.added_by;
    perform recompute_cities_contributed(new.added_by);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_places_added on places;
create trigger trg_bump_places_added
  after insert on places
  for each row execute function bump_places_added();

-- verifications: only approved confirms count toward total_verifications and
-- may unlock a new explored city.
create or replace function bump_verifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'confirm' and new.status = 'approved' then
    update profiles set total_verifications = total_verifications + 1 where id = new.user_id;
    perform recompute_cities_contributed(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_verifications on verifications;
create trigger trg_bump_verifications
  after insert on verifications
  for each row execute function bump_verifications();

-- reviews: flat increment.
create or replace function bump_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set total_reviews = total_reviews + 1 where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_reviews on reviews;
create trigger trg_bump_reviews
  after insert on reviews
  for each row execute function bump_reviews();

-- ============================================
-- 4) record_session RPC (session counters)
-- ============================================
-- Called once per app-open from the client (lib/session.ts). Bumps
-- total_sessions, and total_days_active iff this open is the first activity
-- of a new calendar day. It also advances last_active_at so the day-rollover
-- comparison is self-contained — call this at session start INSTEAD of the
-- first touchLastActive() of the session (the hourly heartbeat still runs).
create or replace function record_session(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  select last_active_at into v_last from profiles where id = p_user_id;

  update profiles
  set total_sessions    = total_sessions + 1,
      total_days_active = total_days_active
        + case when v_last is null or v_last::date < (now())::date then 1 else 0 end,
      last_active_at    = now()
  where id = p_user_id;
end;
$$;

-- ============================================
-- 5) One-time backfill of the contribution counters
-- ============================================
-- Session counters intentionally stay at 0 — historical sessions are not
-- reconstructable. They accumulate from the next app-open.

update profiles p
set total_places_added = coalesce(a.c, 0)
from (select added_by as uid, count(*) c from places where added_by is not null group by added_by) a
where a.uid = p.id;

update profiles p
set total_verifications = coalesce(a.c, 0)
from (
  select user_id as uid, count(*) c
  from verifications
  where type = 'confirm' and status = 'approved'
  group by user_id
) a
where a.uid = p.id;

update profiles p
set total_reviews = coalesce(a.c, 0)
from (select user_id as uid, count(*) c from reviews group by user_id) a
where a.uid = p.id;

update profiles p
set cities_contributed = coalesce(a.c, 0)
from (
  select uid, count(distinct city) c
  from (
    select added_by as uid, city from places where added_by is not null and city is not null
    union
    select v.user_id as uid, pl.city
    from verifications v
    join places pl on pl.id = v.place_id
    where v.type = 'confirm' and v.status = 'approved' and pl.city is not null
  ) src
  group by uid
) a
where a.uid = p.id;
