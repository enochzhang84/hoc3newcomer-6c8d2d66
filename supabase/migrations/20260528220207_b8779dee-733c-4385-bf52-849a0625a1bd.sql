ALTER TABLE public.display_playlist_items ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE public.display_playlists ADD COLUMN IF NOT EXISTS loop_enabled boolean NOT NULL DEFAULT true;