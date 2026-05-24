
CREATE TABLE public.fellowships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fellowships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read active fellowships"
ON public.fellowships FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "admins read all fellowships"
ON public.fellowships FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins manage fellowships"
ON public.fellowships FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_fellowships_updated_at
BEFORE UPDATE ON public.fellowships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.fellowships (name, sort_order) VALUES
  ('小羊團契', 1),
  ('Chadbourne', 2),
  ('單身職業青年小組', 3),
  ('粵語團契', 4),
  ('幸福聊天室', 5),
  ('恩典茶經小組', 6),
  ('長青團契', 7),
  ('活水團契', 8),
  ('愛加倍團契(園區)', 9),
  ('愛加倍團契(山區)', 10),
  ('愛加倍團契(湖區)', 11),
  ('愛加倍團契(以諾一組)', 12),
  ('愛加倍團契(以諾二組)', 13),
  ('中區查經班', 14),
  ('神州團契', 15),
  ('神州約書亞小組', 16),
  ('Ohlone', 17),
  ('Weibel', 18),
  ('迦勒團契', 19),
  ('磐石團契(隔週)', 20),
  ('北區查經', 21);
