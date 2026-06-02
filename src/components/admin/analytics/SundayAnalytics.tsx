import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, groupBy } from "./AnalyticsPrimitives";

type Checkin = { checkin_date: string; course_name: string | null };
type Course = { id: string; name: string; is_active: boolean };
type Teacher = { id: string; is_active: boolean };
type Class = { class_name: string | null; student_count: number };

export function SundayAnalytics() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, co, t, sc] = await Promise.all([
        supabase.from("sunday_school_checkins").select("checkin_date,course_name").order("checkin_date", { ascending: false }).limit(500),
        supabase.from("sunday_school_courses").select("id,name,is_active"),
        supabase.from("sunday_school_teachers").select("id,is_active"),
        supabase.from("sunday_class_schedule").select("class_name,student_count"),
      ]);
      setCheckins((c.data ?? []) as Checkin[]);
      setCourses((co.data ?? []) as Course[]);
      setTeachers((t.data ?? []) as Teacher[]);
      setClasses((sc.data ?? []) as Class[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;

  const totalStudents = classes.reduce((s, x) => s + (x.student_count ?? 0), 0);
  const activeCourses = courses.filter((c) => c.is_active).length;
  const activeTeachers = teachers.filter((t) => t.is_active).length;
  const byCourse = groupBy(checkins, (x) => x.course_name || "未填");
  const byDate = groupBy(checkins, (x) => x.checkin_date).slice(0, 8).reverse().map((x) => ({ key: x.key.slice(5), count: x.count }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="学生总数" value={totalStudents} hint={`${classes.length} 个班级`} />
        <StatCard label="开课中" value={activeCourses} />
        <StatCard label="在职老师" value={activeTeachers} />
        <StatCard label="累计签到" value={checkins.length} />
      </div>
      <Section title="出勤分布（课程）"><MiniBars items={byCourse} /></Section>
      <Section title="近期出勤趋势"><MiniBars items={byDate} /></Section>
    </div>
  );
}