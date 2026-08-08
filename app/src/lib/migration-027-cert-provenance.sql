-- Migration 027: certification provenance + computed effective trust level
--
-- Data-accuracy program WS1. Makes level 4 (Trusted) mean "a certification body
-- says so, and the cert is current", storable + auditable + REVERSIBLE when a
-- cert lapses. Signed off 2026-08-08 with amendments (applied below):
--   * effective_halal_level keys off cert_status='current' ONLY — NO CURRENT_DATE
--     (Postgres rejects non-IMMUTABLE expressions in a generated column); the
--     daily expiry-flip job below carries the time logic.
--   * cert columns mirrored on places_staging; promote_staged_place carries them.
--   * uniform quarterly re-check cadence + a 120-day staleness alert for rows
--     whose body publishes no expiry (cert_expires IS NULL).
--   * CHECK (halal_level BETWEEN 1 AND 3): confirmed 0 legacy level-4 rows.
--
-- Numbering: 025 latest applied, 026 RESERVED for the M4 share model, this is 027.
-- Run manually in the Supabase SQL Editor. Deploy order: apply this → verify
-- (dry-run gates below) → Singapore pilot writes cert data → Sani audits →
-- ONLY THEN flip the app read-path to effective_halal_level via OTA.

begin;

-- 1) Cert provenance on places -------------------------------------------------
alter table places
  add column if not exists cert_body         text,
  add column if not exists cert_id           text,
  add column if not exists cert_issued        date,
  add column if not exists cert_expires       date,   -- NULL where the body doesn't publish it
  add column if not exists cert_last_checked  timestamptz,
  add column if not exists cert_status        text
    check (cert_status in ('current','expired','revoked','unverified'));

-- 2) Community level stays 1..3; level 4 is cert-only (via effective level below)
--    Confirmed 0 rows at level 4 before adding this constraint.
alter table places
  add constraint places_halal_level_community_range check (halal_level between 1 and 3);

-- 3) Computed effective level. GREATEST(community, cert-if-current). Keys off
--    cert_status ONLY (IMMUTABLE) — the daily job flips 'current'->'expired' so
--    a lapsed cert falls back to the earned community level, never to zero.
alter table places
  add column if not exists effective_halal_level int
  generated always as (
    greatest(halal_level, case when cert_status = 'current' then 4 else 0 end)
  ) stored;

create index if not exists idx_places_effective_level on places (effective_halal_level);

-- 4) Mirror cert columns on staging so a match found at scrape/reconcile time
--    carries through promotion.
alter table places_staging
  add column if not exists cert_body        text,
  add column if not exists cert_id          text,
  add column if not exists cert_issued       date,
  add column if not exists cert_expires      date,
  add column if not exists cert_status       text
    check (cert_status in ('current','expired','revoked','unverified'));

-- 5) promote_staged_place carries cert fields through. (Full body re-stated from
--    migration 013 + the cert columns; cert_last_checked stamped now() when a
--    cert is present.)
create or replace function promote_staged_place(p_staging_id uuid, p_added_by uuid)
returns uuid
language plpgsql
as $$
declare
  s places_staging%rowtype;
  v_place_id uuid;
  v_source_record jsonb;
  v_city text;
  v_country_lookup text;
begin
  select * into s from places_staging where id = p_staging_id;
  if s.id is null then
    raise exception 'Staging row % not found', p_staging_id;
  end if;
  if s.promoted_to_place_id is not null then
    return s.promoted_to_place_id;
  end if;
  if s.latitude is null or s.longitude is null then
    raise exception 'Staging row % has no coordinates', p_staging_id;
  end if;

  v_source_record := jsonb_build_object(
    'source', s.source, 'source_id', s.source_id, 'imported_at', now()
  );

  select display_name, country into v_city, v_country_lookup
  from (values
    ('tokyo','Tokyo','Japan'),('osaka','Osaka','Japan'),('kyoto','Kyoto','Japan'),
    ('seoul','Seoul','South Korea'),('bangkok','Bangkok','Thailand'),
    ('singapore','Singapore','Singapore'),('taipei','Taipei','Taiwan'),
    ('hong_kong','Hong Kong','Hong Kong'),('ho_chi_minh','Ho Chi Minh City','Vietnam'),
    ('hanoi','Hanoi','Vietnam'),('chiang_mai','Chiang Mai','Thailand'),
    ('phuket','Phuket','Thailand'),('manila','Manila','Philippines')
  ) as c(slug, display_name, country)
  where c.slug = s.city;

  insert into places (
    name_en, name_local, address_en, address_local,
    latitude, longitude, coord_system,
    cuisine_type, price_range, halal_level, place_type,
    description, hours, photos,
    added_by, last_verified_at, verification_count,
    is_active, sources, city, country,
    cert_body, cert_id, cert_issued, cert_expires, cert_status, cert_last_checked
  ) values (
    s.name_en, s.name_local, coalesce(s.address_en, ''), s.address_local,
    s.latitude, s.longitude, 'WGS84',
    coalesce(s.cuisine_type, 'other'), s.price_range, s.proposed_halal_level,
    coalesce(s.place_type, 'restaurant'),
    s.description, s.hours, '{}',
    p_added_by, null, 0,
    true, jsonb_build_array(v_source_record), v_city, coalesce(s.country, v_country_lookup),
    s.cert_body, s.cert_id, s.cert_issued, s.cert_expires, s.cert_status,
    case when s.cert_status is not null then now() else null end
  )
  returning id into v_place_id;

  update places_staging
  set reviewed = true, approved = true,
      promoted_to_place_id = v_place_id, reviewed_at = now()
  where id = p_staging_id;

  return v_place_id;
end;
$$;

-- 6) Daily expiry-flip: a cert past its expiry date falls out of 'current', which
--    (via the generated column) drops effective_halal_level to the community
--    level. This is the load-bearing time logic the generated column can't hold.
create or replace function flip_expired_certs()
returns int
language sql
as $$
  with flipped as (
    update places
       set cert_status = 'expired'
     where cert_status = 'current'
       and cert_expires is not null
       and cert_expires < current_date
    returning 1
  )
  select count(*)::int from flipped;
$$;

-- 7) Freshness audit (feeds the weekly governance read + monthly backstop):
--    (a) expired-but-Trusted MUST be 0 (the daily flip guarantees it; alert if not)
--    (b) stale: current certs with no published expiry, unchecked > 120 days.
create or replace function cert_freshness_audit()
returns table(metric text, count bigint)
language sql
as $$
  select 'expired_but_trusted', count(*) from places
    where effective_halal_level = 4 and cert_status <> 'current'
  union all
  select 'stale_no_expiry_120d', count(*) from places
    where cert_status = 'current' and cert_expires is null
      and (cert_last_checked is null or cert_last_checked < now() - interval '120 days')
  union all
  select 'trusted_total', count(*) from places where effective_halal_level = 4;
$$;

-- 8) Schedule: daily expiry flip + reuse the §8.5 monthly audit cron for the
--    zero-expired-Trusted backstop. (pg_cron; migration 022 established it.)
select cron.schedule('cert-expiry-flip-daily', '15 0 * * *', $$select flip_expired_certs();$$)
  where not exists (select 1 from cron.job where jobname = 'cert-expiry-flip-daily');

commit;

-- ============================================================================
-- DRY-RUN GATES (run BEFORE applying against prod — on a branch/backup):
--   1. select count(*) from places where effective_halal_level <> halal_level;
--      -- MUST be 0 immediately post-migration (nothing certified yet).
--   2. Insert a throwaway row, set cert_status='current' → effective becomes 4;
--      set cert_status='expired' → effective falls back to halal_level. Delete it.
--   3. Confirm the community-upgrade trigger still fires (verification_count>=3
--      still lifts halal_level to 2; effective tracks it).
--
-- ROLLBACK (clean — additive only; safe while the app still reads halal_level):
--   begin;
--     select cron.unschedule('cert-expiry-flip-daily');
--     drop function if exists cert_freshness_audit();
--     drop function if exists flip_expired_certs();
--     -- restore promote_staged_place from migration 013 (cert-free body)
--     alter table places
--       drop column if exists effective_halal_level,
--       drop constraint if exists places_halal_level_community_range,
--       drop column if exists cert_status, drop column if exists cert_last_checked,
--       drop column if exists cert_expires, drop column if exists cert_issued,
--       drop column if exists cert_id, drop column if exists cert_body;
--     alter table places_staging
--       drop column if exists cert_status, drop column if exists cert_expires,
--       drop column if exists cert_issued, drop column if exists cert_id,
--       drop column if exists cert_body;
--   commit;
-- ============================================================================
