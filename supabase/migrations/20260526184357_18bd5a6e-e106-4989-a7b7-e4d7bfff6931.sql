CREATE TABLE public.hospitality_ministry_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_key text NOT NULL,
  service_date date,
  service_item text,
  location text,
  worker text,
  holy_communion boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hospitality_ministry_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_ministry_entries TO authenticated;
GRANT ALL ON public.hospitality_ministry_entries TO service_role;

ALTER TABLE public.hospitality_ministry_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read hospitality entries" ON public.hospitality_ministry_entries
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admins manage hospitality entries" ON public.hospitality_ministry_entries
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_hospitality_panel ON public.hospitality_ministry_entries(panel_key, sort_order);

CREATE TRIGGER set_hospitality_updated_at
BEFORE UPDATE ON public.hospitality_ministry_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();