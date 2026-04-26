-- Migration 008: place_type column
--
-- Distinguishes restaurants from groceries / butchers / bakeries / cafes
-- / street food / sweet shops. The seed pipeline catches a lot of
-- non-restaurant halal businesses (Asian marts, halal butchers) which
-- are still genuinely useful but shouldn't surface as "where to eat".
--
-- Default 'restaurant' so existing rows keep working.
--
-- See planning/data-sourcing-strategy.md and CLAUDE.md.

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS place_type TEXT NOT NULL DEFAULT 'restaurant'
  CHECK (place_type IN (
    'restaurant',
    'grocery',
    'butcher',
    'bakery',
    'cafe',
    'street_food',
    'sweet_shop'
  ));

CREATE INDEX IF NOT EXISTS idx_places_type ON places (place_type);

ALTER TABLE places_staging
  ADD COLUMN IF NOT EXISTS place_type TEXT
  CHECK (place_type IN (
    'restaurant',
    'grocery',
    'butcher',
    'bakery',
    'cafe',
    'street_food',
    'sweet_shop'
  ));

COMMENT ON COLUMN places.place_type IS
  'Type of establishment. Default ''restaurant''. Other values surface differently in the UI (badges, filters) so a user looking for dinner doesn''t get a halal supermarket as the top result.';

-- Update the promote function to carry place_type from staging.
CREATE OR REPLACE FUNCTION promote_staged_place(p_staging_id UUID, p_added_by UUID)
RETURNS UUID AS $$
DECLARE
  s places_staging%ROWTYPE;
  v_place_id UUID;
  v_source_record JSONB;
BEGIN
  SELECT * INTO s FROM places_staging WHERE id = p_staging_id;

  IF s.id IS NULL THEN
    RAISE EXCEPTION 'Staging row % not found', p_staging_id;
  END IF;

  IF s.promoted_to_place_id IS NOT NULL THEN
    RETURN s.promoted_to_place_id;
  END IF;

  IF s.latitude IS NULL OR s.longitude IS NULL THEN
    RAISE EXCEPTION 'Staging row % has no coordinates', p_staging_id;
  END IF;

  v_source_record := jsonb_build_object(
    'source', s.source,
    'source_id', s.source_id,
    'imported_at', now()
  );

  INSERT INTO places (
    name_en, name_local, address_en, address_local,
    latitude, longitude, coord_system,
    cuisine_type, price_range, halal_level, place_type,
    description, hours, photos,
    added_by, last_verified_at, verification_count,
    is_active, sources
  ) VALUES (
    s.name_en,
    s.name_local,
    COALESCE(s.address_en, ''),
    s.address_local,
    s.latitude,
    s.longitude,
    'WGS84',
    COALESCE(s.cuisine_type, 'other'),
    s.price_range,
    s.proposed_halal_level,
    COALESCE(s.place_type, 'restaurant'),
    s.description,
    s.hours,
    '{}',
    p_added_by,
    NULL,
    0,
    true,
    jsonb_build_array(v_source_record)
  )
  RETURNING id INTO v_place_id;

  UPDATE places_staging
  SET reviewed = true,
      approved = true,
      promoted_to_place_id = v_place_id,
      reviewed_at = now()
  WHERE id = p_staging_id;

  RETURN v_place_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Backfill known non-restaurants in already-promoted data
-- ============================================
-- Run after the migration to retag obvious non-restaurants in Tokyo/Osaka.
-- Conservative — only catches very clear name signals. The rest gets
-- corrected manually or stays default 'restaurant' (less wrong than not
-- having the data at all).

UPDATE places
SET place_type = 'grocery'
WHERE place_type = 'restaurant'
  AND LOWER(name_en) ~ '(mart|grocery|supermarket|halal shop|asian shop|asian store|halal store)';

UPDATE places
SET place_type = 'butcher'
WHERE place_type = 'restaurant'
  AND LOWER(name_en) ~ '(butcher|meat shop|meat house)';

UPDATE places
SET place_type = 'bakery'
WHERE place_type = 'restaurant'
  AND LOWER(name_en) ~ '(bakery|bread|patisserie|boulangerie)';

UPDATE places
SET place_type = 'sweet_shop'
WHERE place_type = 'restaurant'
  AND LOWER(name_en) ~ '(confectionery|sweet shop|sweets|chocolate)';

UPDATE places
SET place_type = 'cafe'
WHERE place_type = 'restaurant'
  AND LOWER(name_en) ~ '(\bcafe\b|coffee|espresso|tea house|tea room)';
