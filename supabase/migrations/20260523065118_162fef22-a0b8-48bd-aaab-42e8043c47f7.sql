
-- Add viewer role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Ensure hoc3nc@gmail.com is admin (if user exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'hoc3nc@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
