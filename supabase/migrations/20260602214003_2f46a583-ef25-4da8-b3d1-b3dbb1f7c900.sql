
CREATE TABLE public.kids_promotion_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL,
  season text NOT NULL CHECK (season IN ('spring','fall')),
  from_class text,
  to_class text,
  student_name text NOT NULL,
  promotion_date date,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kids_promotion_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_promotion_records TO authenticated;
GRANT ALL ON public.kids_promotion_records TO service_role;

ALTER TABLE public.kids_promotion_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read kids promotion records"
ON public.kids_promotion_records FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "admins manage kids promotion records"
ON public.kids_promotion_records FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "ss workers manage kids promotion records"
ON public.kids_promotion_records FOR ALL
TO authenticated
USING (worker_in_area(auth.uid(), 'sunday_school'::text))
WITH CHECK (worker_in_area(auth.uid(), 'sunday_school'::text));

CREATE TRIGGER set_updated_at_kids_promotion_records
BEFORE UPDATE ON public.kids_promotion_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_kids_promotion_records_year_season ON public.kids_promotion_records (year, season);
