-- Seed script for App Store reviewer test account.
--
-- USAGE:
-- 1. First, create the auth user via the Supabase Dashboard:
--    - Go to Authentication → Users → Add User
--    - Email: reviewer@halalnomad.app
--    - Password: HalalNomad2026!
--    - CHECK "Auto Confirm User" (skips email verification)
-- 2. Copy the user's UUID from the dashboard
-- 3. Replace <USER_ID> below with that UUID and run this in SQL Editor

-- Update the profile created by the trigger with reviewer-friendly data
UPDATE profiles
SET
  display_name = 'App Reviewer',
  points = 250,
  avatar_url = NULL
WHERE id = '8a7cb0a4-4947-4e88-862c-f9c9259adad3';

-- Add some verification history so "My Activity" looks populated
-- This simulates a user who has been active on the platform
INSERT INTO verifications (place_id, user_id, type, status, created_at)
SELECT
  id AS place_id,
  '8a7cb0a4-4947-4e88-862c-f9c9259adad3' AS user_id,
  'confirm' AS type,
  'approved' AS status,
  NOW() - (random() * INTERVAL '30 days') AS created_at
FROM places
WHERE is_active = true
ORDER BY random()
LIMIT 5;

-- Add one review on a popular place
INSERT INTO reviews (place_id, user_id, rating, text)
SELECT
  id,
  '8a7cb0a4-4947-4e88-862c-f9c9259adad3',
  5,
  'Excellent Halal food! Friendly staff and authentic flavours. Highly recommended for Muslim travellers.'
FROM places
WHERE name_en = 'Tayyabs'
LIMIT 1;

-- Verify the setup
SELECT
  p.display_name,
  p.email,
  p.points,
  (SELECT COUNT(*) FROM verifications WHERE user_id = p.id) AS verifications_count,
  (SELECT COUNT(*) FROM reviews WHERE user_id = p.id) AS reviews_count
FROM profiles p
WHERE p.id = '8a7cb0a4-4947-4e88-862c-f9c9259adad3';
