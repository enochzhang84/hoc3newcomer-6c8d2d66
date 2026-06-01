
-- SECURITY DEFINER function: lets the public display page restore a screen
-- when an emergency/timed broadcast expires. Anon role cannot UPDATE
-- display_screens directly (admin-only RLS), so we expose a narrow RPC.
CREATE OR REPLACE FUNCTION public.expire_display_screen(_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.display_screens%ROWTYPE;
  payload jsonb;
  expires_text text;
  restore jsonb;
  restore_type text;
  restore_payload jsonb;
  restore_playlist uuid;
BEGIN
  SELECT * INTO r FROM public.display_screens WHERE slug = _slug;
  IF NOT FOUND THEN RETURN; END IF;

  payload := COALESCE(r.current_content_payload, '{}'::jsonb);
  expires_text := payload->>'expires_at';
  IF expires_text IS NULL OR expires_text = '' THEN RETURN; END IF;
  IF (expires_text::timestamptz) > now() THEN RETURN; END IF;

  restore := payload->'restore';
  IF restore IS NULL THEN
    -- No restore info; fall back to welcome
    UPDATE public.display_screens
       SET current_content_type = 'welcome',
           current_content_payload = '{}'::jsonb,
           updated_at = now()
     WHERE slug = _slug;
    RETURN;
  END IF;

  restore_type := COALESCE(restore->>'type', 'welcome');
  restore_payload := COALESCE(restore->'payload', '{}'::jsonb);
  BEGIN
    restore_playlist := NULLIF(restore->>'playlist_id', '')::uuid;
  EXCEPTION WHEN others THEN
    restore_playlist := NULL;
  END;

  UPDATE public.display_screens
     SET current_content_type = restore_type,
         current_content_payload = restore_payload,
         playlist_id = restore_playlist,
         updated_at = now()
   WHERE slug = _slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_display_screen(text) TO anon, authenticated;
