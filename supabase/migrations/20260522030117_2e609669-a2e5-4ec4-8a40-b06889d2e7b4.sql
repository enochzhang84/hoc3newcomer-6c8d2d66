
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS faith text,
  ADD COLUMN IF NOT EXISTS faith_years integer,
  ADD COLUMN IF NOT EXISTS faith_other text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS spouse_name text,
  ADD COLUMN IF NOT EXISTS referrer_type text,
  ADD COLUMN IF NOT EXISTS referrer_other text,
  ADD COLUMN IF NOT EXISTS wants_visit boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_info boolean DEFAULT false;
