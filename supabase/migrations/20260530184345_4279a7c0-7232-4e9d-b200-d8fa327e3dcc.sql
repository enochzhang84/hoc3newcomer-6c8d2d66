-- 1) Home page settings table (single-row config)
CREATE TABLE public.home_page_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url text,
  welcome_title text,
  welcome_subtitle text,
  welcome_description text,
  welcome_image_url text,
  qr_title text,
  qr_description text,
  qr_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_page_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_page_settings TO authenticated;
GRANT ALL ON public.home_page_settings TO service_role;

ALTER TABLE public.home_page_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read home_page_settings"
  ON public.home_page_settings FOR SELECT
  USING (true);

CREATE POLICY "admins manage home_page_settings"
  ON public.home_page_settings FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

-- auto-update updated_at
CREATE TRIGGER trg_home_page_settings_updated_at
  BEFORE UPDATE ON public.home_page_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the single config row
INSERT INTO public.home_page_settings (id) VALUES (gen_random_uuid());

-- 2) Public bucket for site assets (logo, welcome bg, qr image)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for site-assets
CREATE POLICY "site-assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "site-assets admins insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin_or_above(auth.uid()));

CREATE POLICY "site-assets admins update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin_or_above(auth.uid()))
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin_or_above(auth.uid()));

CREATE POLICY "site-assets admins delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin_or_above(auth.uid()));
