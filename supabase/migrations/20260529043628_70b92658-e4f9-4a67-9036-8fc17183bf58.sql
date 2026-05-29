-- Decisions (决志) table
CREATE TABLE public.decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_date DATE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  phone TEXT,
  email TEXT,
  fellowship TEXT,
  source TEXT,
  follow_up_person TEXT,
  follow_up_status TEXT NOT NULL DEFAULT 'pending',
  is_baptized BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage decisions" ON public.decisions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_decisions_updated_at BEFORE UPDATE ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_decisions_date ON public.decisions(decision_date DESC);

-- Baptisms (受洗) table
CREATE TABLE public.baptisms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baptism_date DATE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  phone TEXT,
  email TEXT,
  fellowship TEXT,
  baptizing_elder TEXT,
  baptism_type TEXT,
  decision_id UUID REFERENCES public.decisions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.baptisms TO authenticated;
GRANT ALL ON public.baptisms TO service_role;

ALTER TABLE public.baptisms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage baptisms" ON public.baptisms FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_baptisms_updated_at BEFORE UPDATE ON public.baptisms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_baptisms_date ON public.baptisms(baptism_date DESC);
