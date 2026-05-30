
-- 1) 数据迁移：user -> worker
UPDATE public.user_roles SET role = 'worker' WHERE role = 'user';

-- 2) user_profiles 新增字段
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

-- 3) helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_above(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_service_area(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT service_area FROM public.user_profiles WHERE user_id = _uid
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_above(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_service_area(uuid) FROM anon;

-- 4) 替换 handle_new_user：首位注册者 -> super_admin，其后 -> viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_count integer;
  new_role public.app_role;
BEGIN
  SELECT count(*) INTO existing_count FROM public.user_roles;
  IF existing_count = 0 THEN
    new_role := 'super_admin';
  ELSE
    new_role := 'viewer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, new_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) user_roles RLS: admin/super_admin 可读，只有 super_admin 可写
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins see all roles" ON public.user_roles;

CREATE POLICY "admin or above read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "super admin manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 6) user_profiles RLS: 已有 admins manage / authenticated read / 本人 update/insert
-- 增加：super_admin 可改任意人；保留其它
-- 现有 policy 已覆盖大多数情况，无需修改

-- 7) 如果项目里已经存在唯一一个用户但还没有角色，把他设为 super_admin（兜底）
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles)
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;
