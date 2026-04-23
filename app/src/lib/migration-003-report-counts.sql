-- Migration 003: Add report count columns to places
--
-- Tracks how many users have flagged a place as closed or not halal.
-- These are denormalized counters updated by the app for fast reads.

ALTER TABLE places ADD COLUMN IF NOT EXISTS closed_reports INTEGER NOT NULL DEFAULT 0;
ALTER TABLE places ADD COLUMN IF NOT EXISTS not_halal_reports INTEGER NOT NULL DEFAULT 0;

-- Function to increment report counts when a flag verification is inserted
CREATE OR REPLACE FUNCTION increment_report_count(p_place_id UUID, p_type TEXT)
RETURNS void AS $$
BEGIN
  IF p_type = 'flag_closed' THEN
    UPDATE places SET closed_reports = closed_reports + 1 WHERE id = p_place_id;
  ELSIF p_type = 'flag_not_halal' THEN
    UPDATE places SET not_halal_reports = not_halal_reports + 1 WHERE id = p_place_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the nearby_places function to include the new columns
-- (It returns SETOF places, so it automatically picks up new columns)
