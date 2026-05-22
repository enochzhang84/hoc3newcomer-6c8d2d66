-- 1. Tighten registrations INSERT policy
DROP POLICY IF EXISTS "anyone can register" ON public.registrations;

CREATE POLICY "register for active event"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = registrations.event_id
      AND events.is_active = true
  )
);

CREATE POLICY "admins insert registrations"
ON public.registrations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;