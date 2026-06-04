
-- 1. 表（已存在则跳过；若缺字段则补齐）
CREATE TABLE IF NOT EXISTS public.home_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  logo_title text,
  logo_subtitle text,
  welcome_mode text NOT NULL DEFAULT 'text',
  welcome_title text,
  welcome_subtitle text,
  welcome_description text,
  welcome_image_url text,
  welcome_content_html text,
  qr_title text,
  qr_description text,
  qr_image_url text,
  qr_newcomer_url text,
  qr_retreat_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 兼容旧库：补齐可能缺失的列
ALTER TABLE public.home_page_settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_title text,
  ADD COLUMN IF NOT EXISTS logo_subtitle text,
  ADD COLUMN IF NOT EXISTS welcome_mode text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS welcome_title text,
  ADD COLUMN IF NOT EXISTS welcome_subtitle text,
  ADD COLUMN IF NOT EXISTS welcome_description text,
  ADD COLUMN IF NOT EXISTS welcome_image_url text,
  ADD COLUMN IF NOT EXISTS welcome_content_html text,
  ADD COLUMN IF NOT EXISTS qr_title text,
  ADD COLUMN IF NOT EXISTS qr_description text,
  ADD COLUMN IF NOT EXISTS qr_image_url text,
  ADD COLUMN IF NOT EXISTS qr_newcomer_url text,
  ADD COLUMN IF NOT EXISTS qr_retreat_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. 授权（PostgREST 必需）
GRANT SELECT ON public.home_page_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_page_settings TO authenticated;
GRANT ALL ON public.home_page_settings TO service_role;

-- 3. RLS
ALTER TABLE public.home_page_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read home_page_settings" ON public.home_page_settings;
CREATE POLICY "anyone read home_page_settings"
  ON public.home_page_settings FOR SELECT
  TO public USING (true);

DROP POLICY IF EXISTS "admins manage home_page_settings" ON public.home_page_settings;
CREATE POLICY "admins manage home_page_settings"
  ON public.home_page_settings FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

-- 4. updated_at 自动维护
DROP TRIGGER IF EXISTS set_home_page_settings_updated_at ON public.home_page_settings;
CREATE TRIGGER set_home_page_settings_updated_at
  BEFORE UPDATE ON public.home_page_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. 没有任何记录时插入默认行
INSERT INTO public.home_page_settings (
  logo_title, logo_subtitle,
  welcome_mode, welcome_title, welcome_subtitle, welcome_description,
  qr_title, qr_description
)
SELECT
  '基督之家', '第三家',
  'text', '基督之家', '第三家',
  E'这家就是永生神的教会\n真理的柱石和根基 (提前 3:15)',
  '扫码登记', '欢迎新朋友扫码填写资料'
WHERE NOT EXISTS (SELECT 1 FROM public.home_page_settings);
