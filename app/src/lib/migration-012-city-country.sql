-- Migration 012: city + country columns on places
--
-- Right now places only have free-text address fields. Browsing by
-- city/country is impossible without parsing addresses. The Browse
-- view (added alongside Map and List on the Explore tab) needs
-- structured geography.
--
-- Adds two columns, backfills the existing 1,361 seeded places from
-- their staging row, and updates the promote_staged_place RPC so
-- future promotions carry city + country forward.
--
-- User-added places (via add.tsx) currently leave city/country NULL.
-- Future enhancement: pick from a list of supported cities at add
-- time, OR reverse-geocode lat/lng. For now, NULL means "won't show
-- in Browse view" — acceptable until users start adding places.

alter table places add column if not exists city text;
alter table places add column if not exists country text;

create index if not exists idx_places_city on places (city);
create index if not exists idx_places_country on places (country);

-- ============================================
-- Backfill seeded data
-- ============================================
-- Maps the lowercase city slug used in staging (matches the keys in
-- scripts/seed/cities.py) to display name + country.

update places p
set city = c.display_name,
    country = c.country
from places_staging ps
join (values
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
) as c(slug, display_name, country) on c.slug = ps.city
where ps.promoted_to_place_id = p.id
  and p.city is null;

-- ============================================
-- Update promote_staged_place RPC to copy city/country forward
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
  v_country text;
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

  -- Resolve city + country from the staging slug.
  -- Add new cities here as they're seeded.
  select display_name, country into v_city, v_country
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
    v_country
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
