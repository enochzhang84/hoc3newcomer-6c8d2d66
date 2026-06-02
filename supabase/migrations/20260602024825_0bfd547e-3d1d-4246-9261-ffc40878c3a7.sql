
-- 1. 模块统计分析权限表
CREATE TABLE public.user_module_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_area text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, service_area)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_analytics TO authenticated;
GRANT ALL ON public.user_module_analytics TO service_role;

ALTER TABLE public.user_module_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own analytics flags"
  ON public.user_module_analytics FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_above(auth.uid()));

CREATE POLICY "super admin manage analytics flags"
  ON public.user_module_analytics FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER user_module_analytics_set_updated_at
  BEFORE UPDATE ON public.user_module_analytics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. 统计权限判定函数
CREATE OR REPLACE FUNCTION public.can_view_analytics(_uid uuid, _area text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_above(_uid)
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles p
      LEFT JOIN public.user_module_analytics a
        ON a.user_id = p.user_id AND a.service_area = _area
      WHERE p.user_id = _uid
        AND p.service_area = _area
        AND COALESCE(a.enabled, false) = true
    )
$$;

-- 3. 同工模块业务表访问策略（在 admin 策略之上，按 service_area 放行）
-- 用一个 helper 简化
CREATE OR REPLACE FUNCTION public.worker_in_area(_uid uuid, _area text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = _uid AND service_area = _area AND is_disabled = false
  )
$$;

-- 厨房
CREATE POLICY "kitchen workers manage meal_plans"
  ON public.meal_plans FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'kitchen'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'kitchen'));

CREATE POLICY "kitchen workers manage meal_types"
  ON public.meal_types FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'kitchen'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'kitchen'));

CREATE POLICY "kitchen workers manage event_meal_notes"
  ON public.event_meal_notes FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'kitchen'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'kitchen'));

CREATE POLICY "kitchen workers read attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (public.worker_in_area(auth.uid(), 'kitchen'));

-- 主日学
CREATE POLICY "ss workers manage courses"
  ON public.sunday_school_courses FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'sunday_school'));

CREATE POLICY "ss workers manage teachers"
  ON public.sunday_school_teachers FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'sunday_school'));

CREATE POLICY "ss workers read checkins"
  ON public.sunday_school_checkins FOR SELECT TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'));

CREATE POLICY "ss workers delete checkins"
  ON public.sunday_school_checkins FOR DELETE TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'));

CREATE POLICY "ss workers manage class schedule"
  ON public.sunday_class_schedule FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'sunday_school'));

CREATE POLICY "ss workers manage kids snapshots"
  ON public.kids_class_enrollment_snapshots FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'sunday_school'));

CREATE POLICY "ss workers read adult class checkins"
  ON public.adult_class_checkins FOR SELECT TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'));

CREATE POLICY "ss workers read fellowship checkins"
  ON public.fellowship_checkins FOR SELECT TO authenticated
  USING (public.worker_in_area(auth.uid(), 'sunday_school'));

-- 新人登记
CREATE POLICY "newcomer workers manage registrations"
  ON public.registrations FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'newcomer'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'newcomer'));

CREATE POLICY "newcomer workers manage events"
  ON public.events FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'newcomer'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'newcomer'));

-- 退修会
CREATE POLICY "retreat workers manage registrations"
  ON public.retreat_registrations FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'retreat'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'retreat'));

-- 迎宾接待
CREATE POLICY "welcome workers manage hospitality"
  ON public.hospitality_ministry_entries FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'welcome'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'welcome'));

CREATE POLICY "welcome workers manage duty personnel"
  ON public.duty_personnel FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'welcome'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'welcome'));

CREATE POLICY "welcome workers manage duty schedules"
  ON public.duty_schedules FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'welcome'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'welcome'));

CREATE POLICY "welcome workers manage fellowships"
  ON public.fellowships FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'welcome'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'welcome'));

CREATE POLICY "welcome workers manage ministry entries"
  ON public.ministry_service_entries FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'welcome'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'welcome'));

-- 影音
CREATE POLICY "media workers manage av_notes"
  ON public.av_notes FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'media'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'media'));

CREATE POLICY "media workers manage av_broadcasts"
  ON public.av_broadcasts FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'media'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'media'));

-- TV 屏幕
CREATE POLICY "tv workers manage screens"
  ON public.display_screens FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'));

CREATE POLICY "tv workers manage playlists"
  ON public.display_playlists FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'));

CREATE POLICY "tv workers manage playlist items"
  ON public.display_playlist_items FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'));

CREATE POLICY "tv workers manage posters"
  ON public.display_posters FOR ALL TO authenticated
  USING (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'tv_display') OR public.worker_in_area(auth.uid(), 'media'));
