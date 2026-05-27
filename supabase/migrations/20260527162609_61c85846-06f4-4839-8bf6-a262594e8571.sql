CREATE TABLE public.user_presence (
  user_id UUID NOT NULL PRIMARY KEY,
  worker_name TEXT,
  display_name TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read presence" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "user upsert own presence" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user update own presence" ON public.user_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX user_presence_last_seen_idx ON public.user_presence (last_seen_at DESC);