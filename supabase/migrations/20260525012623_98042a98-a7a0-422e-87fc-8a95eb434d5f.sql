
CREATE TABLE public.meal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage meal_types" ON public.meal_types FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_meal_types_updated BEFORE UPDATE ON public.meal_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date date NOT NULL,
  attendees integer NOT NULL DEFAULT 0,
  meal_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage meal_plans" ON public.meal_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_meal_plans_updated BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.duty_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.duty_personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage duty_personnel" ON public.duty_personnel FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_duty_personnel_updated BEFORE UPDATE ON public.duty_personnel
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.duty_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_type text NOT NULL CHECK (schedule_type IN ('sunday','summer')),
  slot_time text NOT NULL,
  ppt_person text,
  live_person text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.duty_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage duty_schedules" ON public.duty_schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_duty_schedules_updated BEFORE UPDATE ON public.duty_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.meal_types(name, sort_order) VALUES
  ('中餐',1),('西餐',2),('面点',3),('快餐',4);
