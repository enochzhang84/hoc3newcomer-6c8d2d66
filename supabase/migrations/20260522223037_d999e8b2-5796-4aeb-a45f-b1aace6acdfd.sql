
CREATE TABLE public.service_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT,
  phone TEXT,
  wechat TEXT,
  service_project TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit service application"
ON public.service_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "admins read service applications"
ON public.service_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update service applications"
ON public.service_applications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete service applications"
ON public.service_applications
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
