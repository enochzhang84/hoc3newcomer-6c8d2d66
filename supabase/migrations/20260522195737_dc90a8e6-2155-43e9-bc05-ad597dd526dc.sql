CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read messages"
ON public.messages FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "authenticated insert messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated update messages"
ON public.messages FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "authenticated delete messages"
ON public.messages FOR DELETE
TO authenticated
USING (true);

CREATE INDEX idx_messages_updated_at ON public.messages(updated_at DESC);