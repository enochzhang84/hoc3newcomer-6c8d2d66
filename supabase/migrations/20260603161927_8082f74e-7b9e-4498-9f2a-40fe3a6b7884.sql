
ALTER TABLE public.home_page_settings
  ADD COLUMN IF NOT EXISTS logo_title TEXT,
  ADD COLUMN IF NOT EXISTS logo_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS welcome_mode TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS welcome_content_html TEXT,
  ADD COLUMN IF NOT EXISTS qr_newcomer_url TEXT,
  ADD COLUMN IF NOT EXISTS qr_retreat_url TEXT;
