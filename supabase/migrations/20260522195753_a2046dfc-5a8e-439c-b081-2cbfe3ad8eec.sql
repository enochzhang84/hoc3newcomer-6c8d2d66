DROP POLICY IF EXISTS "authenticated insert messages" ON public.messages;
DROP POLICY IF EXISTS "authenticated update messages" ON public.messages;
DROP POLICY IF EXISTS "authenticated delete messages" ON public.messages;

CREATE POLICY "admins insert messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update messages"
ON public.messages FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete messages"
ON public.messages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));