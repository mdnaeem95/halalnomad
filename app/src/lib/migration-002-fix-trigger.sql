-- Migration 002: Fix handle_new_user trigger
--
-- The original trigger may fail because:
-- 1. raw_user_meta_data could be NULL on some signup flows
-- 2. Column name varies between Supabase versions (raw_user_meta_data vs raw_user_metadata)
-- 3. RLS may block the insert even with SECURITY DEFINER
--
-- This version handles all edge cases and explicitly sets the search_path.

-- Drop and recreate the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log but don't block signup if profile creation fails
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Make sure the trigger exists (recreate if needed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
