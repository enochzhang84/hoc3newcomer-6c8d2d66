
-- Notes table for 影音记事本
CREATE TABLE public.av_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT '其他',
  is_pinned boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.av_notes TO authenticated;
GRANT ALL ON public.av_notes TO service_role;

ALTER TABLE public.av_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage av_notes" ON public.av_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_av_notes_updated_at BEFORE UPDATE ON public.av_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Emergency broadcast history
CREATE TABLE public.av_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'normal',
  targets text[] NOT NULL DEFAULT '{}',
  duration_seconds integer,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.av_broadcasts TO authenticated;
GRANT SELECT ON public.av_broadcasts TO anon;
GRANT ALL ON public.av_broadcasts TO service_role;

ALTER TABLE public.av_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read av_broadcasts" ON public.av_broadcasts FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "admins manage av_broadcasts" ON public.av_broadcasts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
