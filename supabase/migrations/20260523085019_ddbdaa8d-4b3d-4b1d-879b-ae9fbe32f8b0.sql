-- Allow authenticated users (any role) to read all backend data
CREATE POLICY "authenticated read registrations"
ON public.registrations FOR SELECT TO authenticated
USING (true);

CREATE POLICY "authenticated read attendance"
ON public.attendance_records FOR SELECT TO authenticated
USING (true);

CREATE POLICY "authenticated read service applications"
ON public.service_applications FOR SELECT TO authenticated
USING (true);

-- Revert message board edits to admin-only
DROP POLICY IF EXISTS "admins or users insert messages" ON public.messages;
DROP POLICY IF EXISTS "admins or users update messages" ON public.messages;
DROP POLICY IF EXISTS "admins or users delete messages" ON public.messages;

CREATE POLICY "admins insert messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update messages"
ON public.messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete messages"
ON public.messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));