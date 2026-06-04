ALTER TABLE public.sunday_class_schedule
  ADD COLUMN IF NOT EXISTS student_count integer NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';