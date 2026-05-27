
CREATE TABLE public.user_profiles (
  user_id UUID NOT NULL PRIMARY KEY,
  worker_name TEXT,
  service_project TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read user_profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user upsert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage user_profiles" ON public.user_profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));
CREATE TRIGGER user_profiles_set_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read chat" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own chat" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own chat" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage chat" ON public.chat_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));
CREATE INDEX chat_messages_created_at_idx ON public.chat_messages(created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
