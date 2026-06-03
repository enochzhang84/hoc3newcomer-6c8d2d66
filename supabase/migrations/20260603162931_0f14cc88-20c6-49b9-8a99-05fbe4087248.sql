
CREATE TABLE IF NOT EXISTS public.qr_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qr_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.qr_categories TO authenticated;
GRANT ALL ON public.qr_categories TO service_role;

ALTER TABLE public.qr_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read qr_categories" ON public.qr_categories
  FOR SELECT USING (true);
CREATE POLICY "admins manage qr_categories" ON public.qr_categories
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TRIGGER qr_categories_set_updated_at
  BEFORE UPDATE ON public.qr_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.qr_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid REFERENCES public.qr_categories(id) ON DELETE SET NULL,
  target_url text,
  image_url text,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  usage_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.qr_library TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.qr_library TO authenticated;
GRANT ALL ON public.qr_library TO service_role;

ALTER TABLE public.qr_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read qr_library" ON public.qr_library
  FOR SELECT USING (true);
CREATE POLICY "admins manage qr_library" ON public.qr_library
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TRIGGER qr_library_set_updated_at
  BEFORE UPDATE ON public.qr_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS qr_library_category_idx ON public.qr_library(category_id);

INSERT INTO public.qr_categories (name, sort_order) VALUES
  ('新人登记', 10),
  ('退修会', 20),
  ('主日学', 30),
  ('活动报名', 40),
  ('影音事工', 50),
  ('Zoom会议', 60),
  ('奉献二维码', 70),
  ('其他', 999)
ON CONFLICT (name) DO NOTHING;
