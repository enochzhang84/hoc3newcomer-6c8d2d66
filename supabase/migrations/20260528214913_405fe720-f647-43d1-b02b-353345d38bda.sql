
-- =============== display_screens ===============
CREATE TABLE public.display_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  location text,
  orientation text NOT NULL DEFAULT 'landscape',
  current_content_type text NOT NULL DEFAULT 'welcome',
  current_content_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  playlist_id uuid,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.display_screens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_screens TO authenticated;
GRANT ALL ON public.display_screens TO service_role;

ALTER TABLE public.display_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read display_screens"
  ON public.display_screens FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admins manage display_screens"
  ON public.display_screens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_display_screens_updated
  BEFORE UPDATE ON public.display_screens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== display_playlists ===============
CREATE TABLE public.display_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.display_playlists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_playlists TO authenticated;
GRANT ALL ON public.display_playlists TO service_role;

ALTER TABLE public.display_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read display_playlists"
  ON public.display_playlists FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admins manage display_playlists"
  ON public.display_playlists FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_display_playlists_updated
  BEFORE UPDATE ON public.display_playlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== display_playlist_items ===============
CREATE TABLE public.display_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.display_playlists(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  content_type text NOT NULL,
  content_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_display_playlist_items_playlist ON public.display_playlist_items(playlist_id, sort_order);

GRANT SELECT ON public.display_playlist_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_playlist_items TO authenticated;
GRANT ALL ON public.display_playlist_items TO service_role;

ALTER TABLE public.display_playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read display_playlist_items"
  ON public.display_playlist_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admins manage display_playlist_items"
  ON public.display_playlist_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_display_playlist_items_updated
  BEFORE UPDATE ON public.display_playlist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== heartbeat RPC ===============
CREATE OR REPLACE FUNCTION public.touch_display_screen(_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.display_screens SET last_seen_at = now() WHERE slug = _slug;
$$;

GRANT EXECUTE ON FUNCTION public.touch_display_screen(text) TO anon, authenticated;

-- =============== realtime ===============
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_screens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_playlists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_playlist_items;

-- =============== seed tv1..tv5 ===============
INSERT INTO public.display_screens (slug, name, location, orientation, sort_order) VALUES
  ('tv1', '电视 1', '大堂', 'landscape', 1),
  ('tv2', '电视 2', '走廊', 'landscape', 2),
  ('tv3', '电视 3', '主堂入口', 'landscape', 3),
  ('tv4', '电视 4', '副堂', 'landscape', 4),
  ('tv5', '电视 5', '餐厅', 'landscape', 5);
