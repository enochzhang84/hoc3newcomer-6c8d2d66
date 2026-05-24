CREATE TABLE public.fellowship_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_date date NOT NULL,
  name text NOT NULL,
  contact text,
  email text,
  fellowship text NOT NULL,
  prayer_request text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fellowship_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can checkin fellowship" ON public.fellowship_checkins
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admins read fellowship checkins" ON public.fellowship_checkins
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete fellowship checkins" ON public.fellowship_checkins
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));