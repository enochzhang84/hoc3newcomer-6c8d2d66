DROP POLICY IF EXISTS "register for active event" ON public.registrations;

CREATE POLICY "anyone can register"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);