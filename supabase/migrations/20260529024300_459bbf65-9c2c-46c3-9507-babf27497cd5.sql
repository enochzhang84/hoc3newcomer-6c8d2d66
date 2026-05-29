
CREATE TABLE public.event_meal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL,
  event_time text,
  event_name text NOT NULL DEFAULT '',
  event_category text NOT NULL DEFAULT '其他',
  meal_type text,
  attendees integer NOT NULL DEFAULT 0,
  organizer text,
  phone text,
  notes text,
  attachments text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_meal_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_meal_notes TO authenticated;
GRANT ALL ON public.event_meal_notes TO service_role;

ALTER TABLE public.event_meal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read event_meal_notes"
  ON public.event_meal_notes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admins manage event_meal_notes"
  ON public.event_meal_notes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_event_meal_notes_updated
  BEFORE UPDATE ON public.event_meal_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_event_meal_notes_date ON public.event_meal_notes(event_date DESC);
