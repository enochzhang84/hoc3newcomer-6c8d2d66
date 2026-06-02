import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, groupBy } from "./AnalyticsPrimitives";

type MealPlan = { plan_date: string; attendees: number; meal_type: string | null; category: string };
type Attendance = { record_date: string; worship_count: number; children_students: number; children_teachers: number };

export function KitchenAnalytics() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [att, setAtt] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, a] = await Promise.all([
        supabase.from("meal_plans").select("plan_date,attendees,meal_type,category").order("plan_date", { ascending: false }).limit(200),
        supabase.from("attendance_records").select("record_date,worship_count,children_students,children_teachers").order("record_date", { ascending: false }).limit(60),
      ]);
      setPlans((p.data ?? []) as MealPlan[]);
      setAtt((a.data ?? []) as Attendance[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;

  const total = plans.reduce((s, x) => s + (x.attendees ?? 0), 0);
  const sundayTotal = plans.filter((p) => p.category === "sunday").reduce((s, x) => s + (x.attendees ?? 0), 0);
  const last4 = plans.slice(0, 4);
  const avg4 = last4.length > 0 ? Math.round(last4.reduce((s, x) => s + x.attendees, 0) / last4.length) : 0;
  const byMealType = groupBy(plans, (p) => p.meal_type || "未分类");
  const trend = [...att].reverse().slice(-8).map((a) => ({ key: a.record_date.slice(5), count: a.worship_count }));
  const kidsAvg = att.length ? Math.round(att.reduce((s, x) => s + x.children_students, 0) / att.length) : 0;
  const teachersAvg = att.length ? Math.round(att.reduce((s, x) => s + x.children_teachers, 0) / att.length) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="累计就餐" value={total} hint={`${plans.length} 条记录`} />
        <StatCard label="主日就餐" value={sundayTotal} />
        <StatCard label="近4次均值" value={avg4} />
        <StatCard label="儿童均值" value={kidsAvg} hint={`老师均 ${teachersAvg}`} />
      </div>
      <Section title="按餐别分布"><MiniBars items={byMealType} /></Section>
      <Section title="近期主日大堂人数"><MiniBars items={trend} /></Section>
    </div>
  );
}