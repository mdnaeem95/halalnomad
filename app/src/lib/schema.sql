-- HalalNomad Database Schema
-- Run this in the Supabase SQL Editor to set up the database

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PLACES
-- ============================================
CREATE TABLE places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_local TEXT,
  address_en TEXT NOT NULL,
  address_local TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  coord_system TEXT NOT NULL DEFAULT 'WGS84',
  cuisine_type TEXT NOT NULL DEFAULT 'other',
  price_range INTEGER CHECK (price_range BETWEEN 1 AND 4),
  halal_level INTEGER NOT NULL DEFAULT 1 CHECK (halal_level BETWEEN 1 AND 4),
  description TEXT,
  hours TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  added_by UUID REFERENCES profiles(id),
  last_verified_at TIMESTAMPTZ,
  verification_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Geospatial index for fast nearby queries
CREATE INDEX idx_places_location ON places USING gist (
  ll_to_earth(latitude, longitude)
);
CREATE INDEX idx_places_active ON places (is_active) WHERE is_active = true;
CREATE INDEX idx_places_cuisine ON places (cuisine_type);
CREATE INDEX idx_places_halal_level ON places (halal_level);

-- ============================================
-- VERIFICATIONS
-- ============================================
CREATE TABLE verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('confirm', 'certificate', 'flag_closed', 'flag_not_halal')),
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(place_id, user_id, type)
);

CREATE INDEX idx_verifications_place ON verifications (place_id);

-- ============================================
-- REVIEWS
-- ============================================
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX idx_reviews_place ON reviews (place_id);

-- ============================================
-- SAVED LISTS (for future trip planning)
-- ============================================
CREATE TABLE saved_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  place_ids UUID[] NOT NULL DEFAULT '{}',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Find places within a radius (km) of a point
CREATE OR REPLACE FUNCTION nearby_places(lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius_km DOUBLE PRECISION)
RETURNS SETOF places AS $$
  SELECT *
  FROM places
  WHERE is_active = true
    AND earth_box(ll_to_earth(lat, lng), radius_km * 1000) @> ll_to_earth(latitude, longitude)
    AND earth_distance(ll_to_earth(lat, lng), ll_to_earth(latitude, longitude)) <= radius_km * 1000
  ORDER BY earth_distance(ll_to_earth(lat, lng), ll_to_earth(latitude, longitude));
$$ LANGUAGE sql STABLE;

-- Award points to a user
CREATE OR REPLACE FUNCTION award_points(user_id UUID, amount INTEGER)
RETURNS void AS $$
  UPDATE profiles SET points = points + amount WHERE id = user_id;
$$ LANGUAGE sql;

-- Increment verification count and update halal level
CREATE OR REPLACE FUNCTION increment_verification(p_place_id UUID)
RETURNS void AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE places
  SET verification_count = verification_count + 1,
      last_verified_at = now()
  WHERE id = p_place_id
  RETURNING verification_count INTO v_count;

  -- Auto-upgrade halal level based on verification count
  IF v_count >= 3 THEN
    UPDATE places SET halal_level = GREATEST(halal_level, 2) WHERE id = p_place_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Places: anyone can read active places, authenticated users can insert
CREATE POLICY "Places are viewable by everyone" ON places FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can add places" ON places FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Place owners can update" ON places FOR UPDATE USING (auth.uid() = added_by);

-- Verifications: anyone can read, authenticated users can insert
CREATE POLICY "Verifications are viewable by everyone" ON verifications FOR SELECT USING (true);
CREATE POLICY "Authenticated users can verify" ON verifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Reviews: anyone can read, authenticated users can insert their own
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can review" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Saved lists: only the owner can CRUD
CREATE POLICY "Users can manage own lists" ON saved_lists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Shared lists are viewable" ON saved_lists FOR SELECT USING (is_shared = true);

-- ============================================
-- STORAGE BUCKET
-- ============================================
-- Run this in the Supabase dashboard or via API:
-- Create a public bucket called "photos" with 5MB file size limit
-- Allow authenticated users to upload to photos/*
