
-- Feedback table
CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text NOT NULL,
  fellowship text,
  title text NOT NULL,
  description text,
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone submit feedback" ON public.feedbacks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admins read feedback" ON public.feedbacks
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete feedback" ON public.feedbacks
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Public storage bucket for feedback images
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-images', 'feedback-images', true);

CREATE POLICY "feedback images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'feedback-images');

CREATE POLICY "anyone upload feedback images" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'feedback-images');
