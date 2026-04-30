-- Migration 013: country column on places_staging + auto-populate
--
-- Migration 012 added city + country to the live `places` table and
-- resolved both via a hardcoded VALUES lookup inside
-- `promote_staged_place`. That works, but every new city now requires
-- editing the RPC body — easy to forget, easy to drift from
-- `scripts/seed/cities.py`.
--
-- This migration moves country into `places_staging` itself so the
-- scraper can write it at scrape time. The promote RPC now prefers
-- `s.country` and falls back to the VALUES lookup only for legacy
-- rows that pre-date this change.
--
-- City stays as a slug in staging (e.g. "tokyo") — the human-readable
-- display name is still resolved at promote time. Reasoning: changing
-- the slug column would invalidate every existing scraper script and
-- review query.

alter table places_staging add column if not exists country text;

-- ============================================
-- Backfill existing staging rows
-- ============================================

update places_staging ps
set country = c.country
from (values
  ('tokyo',       'Japan'),
  ('osaka',       'Japan'),
  ('kyoto',       'Japan'),
  ('seoul',       'South Korea'),
  ('bangkok',     'Thailand'),
  ('singapore',   'Singapore'),
  ('taipei',      'Taiwan'),
  ('hong_kong',   'Hong Kong'),
  ('ho_chi_minh', 'Vietnam'),
  ('hanoi',       'Vietnam'),
  ('chiang_mai',  'Thailand'),
  ('phuket',      'Thailand'),
  ('manila',      'Philippines')
) as c(slug, country)
where c.slug = ps.city
  and ps.country is null;

-- ============================================
-- Promote RPC — prefer staging.country, fall back to VALUES lookup
-- ============================================

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
    'source', s.source,
    'source_id', s.source_id,
    'imported_at', now()
  );

  -- Resolve display name from slug, and country as a fallback for
  -- legacy staging rows that pre-date the country column.
  -- New cities should be added to scripts/seed/cities.py — staging.country
  -- will then be populated at scrape time and this VALUES table only
  -- needs the display_name row.
  select display_name, country into v_city, v_country_lookup
  from (values
    ('tokyo',       'Tokyo',            'Japan'),
    ('osaka',       'Osaka',            'Japan'),
    ('kyoto',       'Kyoto',            'Japan'),
    ('seoul',       'Seoul',            'South Korea'),
    ('bangkok',     'Bangkok',          'Thailand'),
    ('singapore',   'Singapore',        'Singapore'),
    ('taipei',      'Taipei',           'Taiwan'),
    ('hong_kong',   'Hong Kong',        'Hong Kong'),
    ('ho_chi_minh', 'Ho Chi Minh City', 'Vietnam'),
    ('hanoi',       'Hanoi',            'Vietnam'),
    ('chiang_mai',  'Chiang Mai',       'Thailand'),
    ('phuket',      'Phuket',           'Thailand'),
    ('manila',      'Manila',           'Philippines')
  ) as c(slug, display_name, country)
  where c.slug = s.city;

  insert into places (
    name_en, name_local, address_en, address_local,
    latitude, longitude, coord_system,
    cuisine_type, price_range, halal_level, place_type,
    description, hours, photos,
    added_by, last_verified_at, verification_count,
    is_active, sources,
    city, country
  ) values (
    s.name_en,
    s.name_local,
    coalesce(s.address_en, ''),
    s.address_local,
    s.latitude,
    s.longitude,
    'WGS84',
    coalesce(s.cuisine_type, 'other'),
    s.price_range,
    s.proposed_halal_level,
    coalesce(s.place_type, 'restaurant'),
    s.description,
    s.hours,
    '{}',
    p_added_by,
    null,
    0,
    true,
    jsonb_build_array(v_source_record),
    v_city,
    coalesce(s.country, v_country_lookup)
  )
  returning id into v_place_id;

  update places_staging
  set reviewed = true,
      approved = true,
      promoted_to_place_id = v_place_id,
      reviewed_at = now()
  where id = p_staging_id;

  return v_place_id;
end;
$$;
