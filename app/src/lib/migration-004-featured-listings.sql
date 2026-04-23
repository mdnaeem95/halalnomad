-- Migration 004: Featured Listings
--
-- Adds support for paid featured placement on the map and in search results.

ALTER TABLE places ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE places ADD COLUMN IF NOT EXISTS featured_tier TEXT CHECK (featured_tier IN ('highlighted', 'promoted', 'spotlight'));
ALTER TABLE places ADD COLUMN IF NOT EXISTS featured_expires_at TIMESTAMPTZ;

CREATE INDEX idx_places_featured ON places (is_featured) WHERE is_featured = true;

-- Update nearby_places to sort featured places first
CREATE OR REPLACE FUNCTION nearby_places(lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius_km DOUBLE PRECISION)
RETURNS SETOF places AS $$
  SELECT *
  FROM places
  WHERE is_active = true
    AND earth_box(ll_to_earth(lat, lng), radius_km * 1000) @> ll_to_earth(latitude, longitude)
    AND earth_distance(ll_to_earth(lat, lng), ll_to_earth(latitude, longitude)) <= radius_km * 1000
  ORDER BY
    is_featured DESC,
    earth_distance(ll_to_earth(lat, lng), ll_to_earth(latitude, longitude));
$$ LANGUAGE sql STABLE;
