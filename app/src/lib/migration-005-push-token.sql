-- Migration 005: Push notification token storage
--
-- Stores Expo push tokens on user profiles for server-side notifications.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Example: send a notification when someone's place gets verified
-- (This would be called from a Supabase Edge Function or trigger)
--
-- SELECT push_token FROM profiles WHERE id = <place_owner_id>;
-- Then POST to https://exp.host/--/api/v2/push/send
