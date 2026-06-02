import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, StatGrid, groupBy } from "./AnalyticsPrimitives";

type MealPlan = { plan_date: string; attendees: number; meal_type: string | null; category: string };
type Attendance = { record_date: string; worship_count: number; children_students: number; children_teachers: number };
type ServiceEntry = { entry_date: string; ministry: string | null; service_project: string | null; worker: string | null };

function isKitchenEntry(e: ServiceEntry): boolean {
  const hay = `${e.ministry ?? ""} ${e.service_project ?? ""}`;
  return /厨房|厨|饭|餐|烹|kitchen|meal/i.test(hay);
}

function rankIcon(i: number): string {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
}

export function KitchenAnalytics() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [att, setAtt] = useState<Attendance[]>([]);
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, a, e] = await Promise.all([
        supabase.from("meal_plans").select("plan_date,attendees,meal_type,category").order("plan_date", { ascending: false }).limit(200),
        supabase.from("attendance_records").select("record_date,worship_count,children_students,children_teachers").order("record_date", { ascending: false }).limit(60),
        supabase.from("ministry_service_entries").select("entry_date,ministry,service_project,worker").order("entry_date", { ascending: false }).limit(2000),
      ]);
      setPlans((p.data ?? []) as MealPlan[]);
      setAtt((a.data ?? []) as Attendance[]);
      setEntries(((e.data ?? []) as ServiceEntry[]).filter(isKitchenEntry));
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

  // —— 服侍排行榜 ——
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const valid = entries.filter((e) => e.worker && e.worker.trim() && e.entry_date);
  const inMonth = valid.filter((e) => {
    const d = new Date(e.entry_date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const inYear = valid.filter((e) => new Date(e.entry_date).getFullYear() === y);
  const tally = (list: ServiceEntry[]) => {
    const map = new Map<string, number>();
    for (const e of list) {
      const w = (e.worker as string).trim();
      map.set(w, (map.get(w) ?? 0) + 1);
    }
    return [...map.entries()].map(([worker, count]) => ({ worker, count })).sort((a, b) => b.count - a.count);
  };
  const monthRank = tally(inMonth).slice(0, 10);
  const yearRank = tally(inYear).slice(0, 10);
  const totalWorkers = new Set(valid.map((e) => (e.worker as string).trim())).size;
  const monthWorkers = new Set(inMonth.map((e) => (e.worker as string).trim())).size;
  const participation = totalWorkers > 0 ? Math.round((monthWorkers / totalWorkers) * 100) : 0;

  // 连续服侍周数（按周一为周起点，向前连续）
  const weekKey = (d: Date) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // 周一=0
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const workerWeeks = new Map<string, Set<number>>();
  for (const e of valid) {
    const w = (e.worker as string).trim();
    const k = weekKey(new Date(e.entry_date));
    if (!workerWeeks.has(w)) workerWeeks.set(w, new Set());
    workerWeeks.get(w)!.add(k);
  }
  const thisWeek = weekKey(now);
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const streaks = [...workerWeeks.entries()].map(([worker, set]) => {
    let streak = 0;
    let cursor = thisWeek;
    while (set.has(cursor)) { streak++; cursor -= oneWeek; }
    return { worker, count: streak };
  }).filter((s) => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);

  const RankList = ({ items, unit }: { items: { worker: string; count: number }[]; unit: string }) => (
    items.length === 0 ? <div className="text-xs text-muted-foreground">暂无数据</div> : (
      <ol className="space-y-1">
        {items.map((it, i) => (
          <li key={it.worker} className="flex items-center justify-between text-xs gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 text-center shrink-0">{rankIcon(i)}</span>
              <span className="truncate">{it.worker}</span>
            </span>
            <span className="tabular-nums text-foreground shrink-0">{it.count} {unit}</span>
          </li>
        ))}
      </ol>
    )
  );

  return (
    <div className="space-y-3">
      <StatGrid cols={2}>
        <StatCard compact icon="🍱" label="累计就餐" value={total} hint={`${plans.length} 条记录`} />
        <StatCard compact icon="⛪" label="主日就餐" value={sundayTotal} />
        <StatCard compact icon="📈" label="近4次均值" value={avg4} />
        <StatCard compact icon="👶" label="儿童均值" value={kidsAvg} hint={`老师均 ${teachersAvg}`} />
      </StatGrid>
      <Section title="按餐别分布"><MiniBars items={byMealType} /></Section>
      <Section title="近期主日大堂人数"><MiniBars items={trend} /></Section>

      <Section title="🏆 服侍排行榜">
        <div className="space-y-3">
          <StatGrid cols={3}>
            <StatCard compact label="总同工" value={totalWorkers} />
            <StatCard compact label="本月参与" value={monthWorkers} />
            <StatCard compact label="参与率" value={`${participation}%`} tone={participation >= 50 ? "ok" : participation >= 25 ? "warn" : "alert"} />
          </StatGrid>
          <Section title="本月服侍 Top 10"><div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={monthRank} unit="次" /></div></Section>
          <Section title={`${y} 年累计 Top 10`}><div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={yearRank} unit="次" /></div></Section>
          <Section title="连续服侍周数 Top 10"><div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={streaks} unit="周" /></div></Section>
        </div>
      </Section>
    </div>
  );
}