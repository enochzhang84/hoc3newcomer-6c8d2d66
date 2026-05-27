ALTER TABLE public.meal_plans ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'sunday';
CREATE INDEX IF NOT EXISTS idx_meal_plans_category ON public.meal_plans(category);