INSERT INTO public.user_profiles (user_id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role
)
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role
)
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;