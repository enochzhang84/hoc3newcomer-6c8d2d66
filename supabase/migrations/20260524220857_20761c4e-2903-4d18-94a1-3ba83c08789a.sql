-- Sunday school courses (admin-managed)
CREATE TABLE public.sunday_school_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sunday_school_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read active courses" ON public.sunday_school_courses
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "admins read all courses" ON public.sunday_school_courses
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins manage courses" ON public.sunday_school_courses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON public.sunday_school_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default courses
INSERT INTO public.sunday_school_courses (name, sort_order) VALUES
  ('新旧约书卷', 1),
  ('诗篇及历史书', 2),
  ('丰盛生命', 3),
  ('机要真理', 4),
  ('新约概论', 5),
  ('旧约概论', 6),
  ('主所喜悦的家庭', 7),
  ('因为日期近了', 8);

-- Sunday school check-ins
CREATE TABLE public.sunday_school_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_date DATE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  course_id UUID REFERENCES public.sunday_school_courses(id) ON DELETE SET NULL,
  course_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sunday_school_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can checkin" ON public.sunday_school_checkins
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins read checkins" ON public.sunday_school_checkins
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete checkins" ON public.sunday_school_checkins
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_checkins_date ON public.sunday_school_checkins(checkin_date DESC);