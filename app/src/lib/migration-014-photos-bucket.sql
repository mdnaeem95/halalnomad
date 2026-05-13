-- Migration 014: photos storage bucket
--
-- The app uploads place photos via supabase.storage.from('photos').upload(...)
-- (services/places.ts → uploadPhoto). The bucket itself was never created
-- in production — every photo-attached submission failed with "Bucket not
-- found", which propagated up through pRetry as a generic mutation error.
-- Diagnosed when a tester (post-signup, post-controlled-inputs fix) hit
-- "Failed to add place" and the bucket query came back empty.
--
-- Path convention from uploadPhoto: places/<user_id>/<timestamp>.jpg
-- so storage.foldername(name) → {'places', '<user_id>'} and the
-- 2nd element (1-indexed) is the owning user id.

-- 1. Create the bucket. Public read (photos surface on the place
--    detail screen without auth). 5 MB / file. Common image types only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies on storage.objects (RLS is enabled by default in Supabase).

DROP POLICY IF EXISTS "Photos: public read" ON storage.objects;
CREATE POLICY "Photos: public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Photos: authenticated upload to own folder" ON storage.objects;
CREATE POLICY "Photos: authenticated upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Photos: users delete own" ON storage.objects;
CREATE POLICY "Photos: users delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
