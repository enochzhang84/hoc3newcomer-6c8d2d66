
-- 1. worship_service_roles
CREATE TABLE public.worship_service_roles (
  service_date date PRIMARY KEY,
  preacher text,
  host text,
  song_leader text,
  pianist text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.worship_service_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worship_service_roles TO authenticated;
GRANT ALL ON public.worship_service_roles TO service_role;
ALTER TABLE public.worship_service_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read worship_service_roles" ON public.worship_service_roles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage worship_service_roles" ON public.worship_service_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER trg_worship_service_roles_updated BEFORE UPDATE ON public.worship_service_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. communion_service
CREATE TABLE public.communion_service (
  service_date date PRIMARY KEY,
  worker_1 text,
  worker_2 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.communion_service TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communion_service TO authenticated;
GRANT ALL ON public.communion_service TO service_role;
ALTER TABLE public.communion_service ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read communion_service" ON public.communion_service FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage communion_service" ON public.communion_service FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER trg_communion_service_updated BEFORE UPDATE ON public.communion_service FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. kitchen_duty
CREATE TABLE public.kitchen_duty (
  service_date date PRIMARY KEY,
  workers text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kitchen_duty TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_duty TO authenticated;
GRANT ALL ON public.kitchen_duty TO service_role;
ALTER TABLE public.kitchen_duty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read kitchen_duty" ON public.kitchen_duty FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage kitchen_duty" ON public.kitchen_duty FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER trg_kitchen_duty_updated BEFORE UPDATE ON public.kitchen_duty FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. custodial_duty
CREATE TABLE public.custodial_duty (
  service_date date PRIMARY KEY,
  workers text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custodial_duty TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custodial_duty TO authenticated;
GRANT ALL ON public.custodial_duty TO service_role;
ALTER TABLE public.custodial_duty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read custodial_duty" ON public.custodial_duty FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage custodial_duty" ON public.custodial_duty FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER trg_custodial_duty_updated BEFORE UPDATE ON public.custodial_duty FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. flower_duty
CREATE TABLE public.flower_duty (
  service_date date PRIMARY KEY,
  workers text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.flower_duty TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flower_duty TO authenticated;
GRANT ALL ON public.flower_duty TO service_role;
ALTER TABLE public.flower_duty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read flower_duty" ON public.flower_duty FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage flower_duty" ON public.flower_duty FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER trg_flower_duty_updated BEFORE UPDATE ON public.flower_duty FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
