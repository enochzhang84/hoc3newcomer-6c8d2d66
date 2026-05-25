
ALTER TABLE public.sunday_class_schedule
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.sunday_school_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_name text,
  ADD COLUMN IF NOT EXISTS weekly_topic text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_sunday_class_schedule_course ON public.sunday_class_schedule(course_id);
