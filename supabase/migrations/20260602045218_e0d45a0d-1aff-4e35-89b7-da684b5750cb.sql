ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS follow_up_status text NOT NULL DEFAULT '未跟进',
  ADD COLUMN IF NOT EXISTS faith_growth_note text;