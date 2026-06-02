-- system notifications + per-user read tracking
CREATE TABLE public.system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  creator_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_notifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.system_notifications TO authenticated;
GRANT ALL ON public.system_notifications TO service_role;

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read system_notifications" ON public.system_notifications
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "super_admin manage system_notifications" ON public.system_notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE public.user_notification_reads (
  user_id uuid NOT NULL,
  notification_id uuid NOT NULL REFERENCES public.system_notifications(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_notification_reads TO authenticated;
GRANT ALL ON public.user_notification_reads TO service_role;

ALTER TABLE public.user_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own notification reads" ON public.user_notification_reads
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_system_notifications_updated_at
  BEFORE UPDATE ON public.system_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();