-- Migration 007: places_staging table
--
-- Holds raw rows from seed scrapers (Google Places, halal cert bodies,
-- aggregators) before a human reviews and promotes them into places.
--
-- The app never reads from this table — it's strictly a back-office
-- pipeline. RLS locked to service role only.
--
-- See planning/data-sourcing-strategy.md and scripts/seed/README.md.

CREATE TABLE IF NOT EXISTS places_staging (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Provenance
  source TEXT NOT NULL,                 -- 'google_places' | 'muis' | 'jha' | 'manual' | ...
  source_id TEXT,                       -- e.g. google_place_id; unique per source
  source_url TEXT,                      -- back-link if applicable

  -- Place data (mirrors places table where possible)
  name_en TEXT NOT NULL,
  name_local TEXT,
  address_en TEXT,
  address_local TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  cuisine_type TEXT,                    -- best-guess; reviewer can correct
  price_range INTEGER CHECK (price_range BETWEEN 1 AND 4),
  description TEXT,
  hours TEXT,
  phone TEXT,
  website TEXT,

  -- Halal trust signals
  proposed_halal_level INTEGER NOT NULL DEFAULT 1
    CHECK (proposed_halal_level BETWEEN 1 AND 4),
  certification_body TEXT,              -- if from a cert directory (e.g. 'JHA', 'MUIS')

  -- Audit
  raw JSONB,                            -- original API response, for debugging
  city TEXT,                            -- which scrape this came from ('Tokyo', 'Seoul', ...)
  search_query TEXT,                    -- e.g. '"halal" near Shinjuku, Tokyo'

  -- Review state
  reviewed BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN,                     -- NULL = pending; true/false set during review
  rejected_reason TEXT,
  promoted_to_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  reviewer_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,

  -- A given source row should land at most once.
  UNIQUE (source, source_id)
);

-- Most queries hit pending rows; partial index keeps it slim.
CREATE INDEX IF NOT EXISTS idx_places_staging_pending
  ON places_staging (created_at ASC)
  WHERE reviewed = false;

-- Per-city review views are common.
CREATE INDEX IF NOT EXISTS idx_places_staging_city_pending
  ON places_staging (city, created_at ASC)
  WHERE reviewed = false;

-- Lock down — only service role touches this.
ALTER TABLE places_staging ENABLE ROW LEVEL SECURITY;
-- No policies = no client access by design.

-- ============================================
-- Add metadata column to places for source tracking
-- ============================================
-- When a staged row gets promoted, we record where it came from so we
-- can filter / re-import / honour takedown requests later.

ALTER TABLE places ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN places.sources IS
  'Array of source records. Each: { "source": "google_places", "source_id": "...", "imported_at": "2026-04-25T..." }. Used for dedupe + provenance.';

-- ============================================
-- Helper: promote a staged row to places
-- ============================================
-- Idempotent. Returns the new places.id (or existing one if already promoted).
-- Sets places_staging.reviewed = true, .approved = true,
-- .promoted_to_place_id, .reviewed_at.

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
    cuisine_type, price_range, halal_level,
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
