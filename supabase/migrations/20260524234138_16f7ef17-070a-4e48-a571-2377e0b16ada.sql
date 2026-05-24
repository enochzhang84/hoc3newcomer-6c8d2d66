CREATE TABLE public.retreat_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_no BIGSERIAL,
  confirmation_no TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  church TEXT,
  serial_no TEXT,
  chinese_name TEXT NOT NULL,
  last_name TEXT,
  first_name TEXT,
  cell TEXT,
  email TEXT,
  gender TEXT,
  program TEXT,
  topic TEXT,
  bed TEXT,
  bus TEXT,
  user_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.retreat_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can register retreat"
  ON public.retreat_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins read retreat"
  ON public.retreat_registrations
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update retreat"
  ON public.retreat_registrations
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete retreat"
  ON public.retreat_registrations
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_retreat_updated_at
  BEFORE UPDATE ON public.retreat_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();