
ALTER TABLE public.sunday_class_schedule ADD COLUMN IF NOT EXISTS student_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.kids_class_enrollment_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL,
  track TEXT NOT NULL,
  class_name TEXT,
  student_count INTEGER NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Los_Angeles')::date,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (class_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_kids_snapshots_date ON public.kids_class_enrollment_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_kids_snapshots_class ON public.kids_class_enrollment_snapshots(class_id);

GRANT SELECT ON public.kids_class_enrollment_snapshots TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids_class_enrollment_snapshots TO authenticated;
GRANT ALL ON public.kids_class_enrollment_snapshots TO service_role;

ALTER TABLE public.kids_class_enrollment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read kids snapshots"
ON public.kids_class_enrollment_snapshots
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "admins manage kids snapshots"
ON public.kids_class_enrollment_snapshots
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
