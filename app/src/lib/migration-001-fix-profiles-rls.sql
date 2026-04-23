-- Migration 001: Fix profiles table INSERT permission
--
-- The handle_new_user trigger needs permission to INSERT into profiles.
-- Even though the trigger function is SECURITY DEFINER, RLS policies
-- still need to explicitly allow the insert operation.

-- Allow the trigger function to insert new profiles
CREATE POLICY "Service role can insert profiles"
  ON profiles
  FOR INSERT
  WITH CHECK (true);
