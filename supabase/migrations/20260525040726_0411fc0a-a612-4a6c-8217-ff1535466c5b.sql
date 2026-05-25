-- Drop overly broad SELECT policy that allows listing all files in the public bucket.
-- Public bucket flag still allows fetching individual files by direct URL.
DROP POLICY IF EXISTS "feedback images public read" ON storage.objects;

-- Tighten bucket settings: only images, max 5MB
UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic']
WHERE id = 'feedback-images';

-- Admins can delete abusive files
CREATE POLICY "admins delete feedback images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'feedback-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));