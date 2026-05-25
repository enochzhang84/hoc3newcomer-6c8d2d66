-- Add super_admin role and assign to specified users
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Commit enum change so the new value can be used below
COMMIT;
BEGIN;

-- Grant admin + super_admin role to the listed emails, plus admin role to tluo2010
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email IN ('junhuangca@gmail.com','hoc3nc@gmail.com','charmzhangliang@gmail.com','tluo2010@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE u.email IN ('junhuangca@gmail.com','hoc3nc@gmail.com','charmzhangliang@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;