ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS recipient_id uuid;
CREATE INDEX IF NOT EXISTS chat_messages_recipient_idx ON public.chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages(created_at DESC);

DROP POLICY IF EXISTS "authenticated read chat" ON public.chat_messages;
CREATE POLICY "read public or own private chat"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  recipient_id IS NULL
  OR auth.uid() = user_id
  OR auth.uid() = recipient_id
);