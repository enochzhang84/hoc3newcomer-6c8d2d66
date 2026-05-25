CREATE TABLE public.adult_class_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('summer','fall')),
  name TEXT NOT NULL,
  fellowship TEXT,
  notes TEXT,
  checkin_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.adult_class_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can checkin adult class"
ON public.adult_class_checkins
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "admins read adult class checkins"
ON public.adult_class_checkins
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete adult class checkins"
ON public.adult_class_checkins
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_adult_class_checkins_kind_time ON public.adult_class_checkins(kind, checkin_at DESC);