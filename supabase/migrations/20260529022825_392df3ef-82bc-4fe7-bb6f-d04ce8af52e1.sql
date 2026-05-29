
-- Posters / 宣传内容
CREATE TABLE public.display_posters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  kind text NOT NULL DEFAULT 'text',            -- image | text | page | external
  title text NOT NULL,
  subtitle text,
  body text,
  image_url text,
  link_url text,
  background text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.display_posters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_posters TO authenticated;
GRANT ALL ON public.display_posters TO service_role;

ALTER TABLE public.display_posters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read display_posters" ON public.display_posters
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admins manage display_posters" ON public.display_posters
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER set_display_posters_updated_at
  BEFORE UPDATE ON public.display_posters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.display_posters;

-- Storage bucket for signage images
INSERT INTO storage.buckets (id, name, public) VALUES ('signage', 'signage', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone read signage images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'signage');

CREATE POLICY "admins upload signage images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signage' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "admins update signage images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signage' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "admins delete signage images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signage' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

-- Seed retreat poster
INSERT INTO public.display_posters (slug, kind, title, subtitle, body, link_url, sort_order)
VALUES (
  'hoc3-retreat',
  'text',
  '🏕 HOC3 联合退修会',
  '休整 · 灵修 · 同行',
  E'欢迎弟兄姐妹报名参加 HOC3 联合退修会。\n\n时间地点详见报名页。\n请扫码或访问报名链接立即登记。',
  '/retreat',
  1
);
