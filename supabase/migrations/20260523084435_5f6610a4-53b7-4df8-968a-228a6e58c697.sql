-- Allow regular users (role 'user') to manage message board posts
DROP POLICY IF EXISTS "admins insert messages" ON public.messages;
DROP POLICY IF EXISTS "admins update messages" ON public.messages;
DROP POLICY IF EXISTS "admins delete messages" ON public.messages;

CREATE POLICY "admins or users insert messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "admins or users update messages"
ON public.messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "admins or users delete messages"
ON public.messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));