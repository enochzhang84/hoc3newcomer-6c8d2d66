
-- Allow users to delete their own presence row (on sign-out / page close)
CREATE POLICY "user delete own presence"
ON public.user_presence
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime broadcasting for user_presence so all devices update live
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Index for fast "online since" queries
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON public.user_presence(last_seen_at);
