
-- Ministries (事工)
CREATE TABLE public.ministries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ministries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ministries TO authenticated;
GRANT ALL ON public.ministries TO service_role;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read ministries" ON public.ministries FOR SELECT USING (true);
CREATE POLICY "admins manage ministries" ON public.ministries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

-- Service projects (服侍项目), optionally linked to a ministry
CREATE TABLE public.service_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ministry_id uuid REFERENCES public.ministries(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_projects TO authenticated;
GRANT ALL ON public.service_projects TO service_role;
ALTER TABLE public.service_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read service_projects" ON public.service_projects FOR SELECT USING (true);
CREATE POLICY "admins manage service_projects" ON public.service_projects FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

-- Ministry service entries (事工服侍 月历记录)
CREATE TABLE public.ministry_service_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  ministry text,
  service_project text,
  worker text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ministry_service_entries_date ON public.ministry_service_entries(entry_date);
GRANT SELECT ON public.ministry_service_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ministry_service_entries TO authenticated;
GRANT ALL ON public.ministry_service_entries TO service_role;
ALTER TABLE public.ministry_service_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read ministry_service_entries" ON public.ministry_service_entries FOR SELECT USING (true);
CREATE POLICY "admins manage ministry_service_entries" ON public.ministry_service_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER trg_ministries_updated BEFORE UPDATE ON public.ministries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_service_projects_updated BEFORE UPDATE ON public.service_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ministry_service_entries_updated BEFORE UPDATE ON public.ministry_service_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults (idempotent-ish; only insert if empty)
INSERT INTO public.ministries (name, sort_order)
SELECT v, row_number() OVER () FROM (VALUES ('迎宾接待'),('厨房事工'),('影音事工'),('主日学'),('团契')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.ministries);

INSERT INTO public.service_projects (name, sort_order)
SELECT v, row_number() OVER () FROM (VALUES ('场地布置'),('接待'),('清洁'),('投影'),('直播'),('饭食准备')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.service_projects);

INSERT INTO public.meal_types (name, sort_order)
SELECT v, row_number() OVER () FROM (VALUES ('盒饭'),('面食'),('饺子'),('自助餐'),('点心'),('其他')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.meal_types);
