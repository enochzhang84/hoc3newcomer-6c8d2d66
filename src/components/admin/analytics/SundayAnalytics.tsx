import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, MiniBars, StatGrid, groupBy } from "./AnalyticsPrimitives";
import { ChevronDown } from "lucide-react";

type AdultCheckin = { checkin_at: string; kind: string; fellowship: string | null };
type FellowshipCheckin = { checkin_date: string; fellowship: string };
type SSCheckin = { checkin_date: string; course_name: string | null };
type ClassRow = { class_name: string | null; student_count: number; track: string | null; teacher_name: string | null };

const SPRING_KEY = "kids_spring_2026";
const FALL_KEY = "kids_fall_2026";

/** 折叠分组面板。复用首页统计卡片风格：米黄底色、圆角、柔和阴影。 */
function Group({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden"
    >
      <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 select-none hover:bg-muted/40 transition-colors">
        <span className="text-sm font-semibold text-foreground/90">{title}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-3 pt-1 space-y-3 border-t border-border/40 bg-background/40">{children}</div>
    </details>
  );
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

export function SundayAnalytics() {
  const [adult, setAdult] = useState<AdultCheckin[]>([]);
  const [fc, setFc] = useState<FellowshipCheckin[]>([]);
  const [ss, setSs] = useState<SSCheckin[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [a, f, s, sc] = await Promise.all([
        supabase.from("adult_class_checkins").select("checkin_at,kind,fellowship").order("checkin_at", { ascending: false }).limit(1000),
        supabase.from("fellowship_checkins").select("checkin_date,fellowship").order("checkin_date", { ascending: false }).limit(1000),
        supabase.from("sunday_school_checkins").select("checkin_date,course_name").order("checkin_date", { ascending: false }).limit(800),
        supabase.from("sunday_class_schedule").select("class_name,student_count,track,teacher_name"),
      ]);
      setAdult((a.data ?? []) as AdultCheckin[]);
      setFc((f.data ?? []) as FellowshipCheckin[]);
      setSs((s.data ?? []) as SSCheckin[]);
      setClasses((sc.data ?? []) as ClassRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;

  // —— 成人主日学 ——
  const summer = adult.filter((x) => x.kind === "summer");
  const fall = adult.filter((x) => x.kind === "fall");
  const adultMonth = adult.filter((x) => isThisMonth(x.checkin_at));
  const adultByFs = groupBy(adult.filter((x) => x.fellowship?.trim()), (x) => x.fellowship!.trim());

  // —— 团契 / 小组聚会 ——
  const fcMonth = fc.filter((x) => isThisMonth(x.checkin_date));
  const fcByFs = groupBy(fc, (x) => x.fellowship || "未填");
  const fcTrend = groupBy(fc, (x) => x.checkin_date).slice(0, 8).reverse().map((x) => ({ key: x.key.slice(5), count: x.count }));

  // —— 儿童主日学统计（合计）——
  const kidsAll = classes.filter((c) => c.track === SPRING_KEY || c.track === FALL_KEY);
  const kidsTotal = kidsAll.reduce((s, x) => s + (x.student_count ?? 0), 0);
  const ssMonth = ss.filter((x) => isThisMonth(x.checkin_date));
  const ssByCourse = groupBy(ss, (x) => x.course_name || "未填");

  // —— 春 / 秋季 ——
  const seasonStats = (key: string) => {
    const list = classes.filter((c) => c.track === key);
    const total = list.reduce((s, x) => s + (x.student_count ?? 0), 0);
    const teachers = new Set(list.map((x) => (x.teacher_name ?? "").trim()).filter(Boolean)).size;
    const byClass = list.map((c) => ({ key: c.class_name || "未命名", count: c.student_count ?? 0 })).sort((a, b) => b.count - a.count);
    return { total, classCount: list.length, teachers, byClass };
  };
  const spring = seasonStats(SPRING_KEY);
  const fallKids = seasonStats(FALL_KEY);

  return (
    <div className="space-y-3">
      <Group title="成人主日学" defaultOpen>
        <StatGrid cols={2}>
          <StatCard compact icon="✅" label="累计签到" value={adult.length} hint={`本月 ${adultMonth.length}`} />
          <StatCard compact icon="☀️" label="夏季 / 秋季" value={`${summer.length} / ${fall.length}`} />
        </StatGrid>
        <div>
          <div className="text-xs font-medium text-foreground/80 mb-2 pl-1">按团契分布</div>
          <MiniBars items={adultByFs} />
        </div>
      </Group>

      <Group title="团契 / 小组聚会">
        <StatGrid cols={2}>
          <StatCard compact icon="🤝" label="累计签到" value={fc.length} hint={`本月 ${fcMonth.length}`} />
          <StatCard compact icon="🏷️" label="团契数" value={fcByFs.length} />
        </StatGrid>
        <div>
          <div className="text-xs font-medium text-foreground/80 mb-2 pl-1">按团契分布</div>
          <MiniBars items={fcByFs} />
        </div>
        <div>
          <div className="text-xs font-medium text-foreground/80 mb-2 pl-1">近期出勤趋势</div>
          <MiniBars items={fcTrend} />
        </div>
      </Group>

      <Group title="儿童主日学统计">
        <StatGrid cols={2}>
          <StatCard compact icon="👧" label="学生总数" value={kidsTotal} hint={`${kidsAll.length} 个班级`} />
          <StatCard compact icon="✅" label="主日学签到" value={ss.length} hint={`本月 ${ssMonth.length}`} />
        </StatGrid>
        <div>
          <div className="text-xs font-medium text-foreground/80 mb-2 pl-1">按课程分布</div>
          <MiniBars items={ssByCourse} />
        </div>
      </Group>

      <Group title="2026 年春季儿童主日学">
        <StatGrid cols={2}>
          <StatCard compact icon="🌸" label="学生数" value={spring.total} hint={`${spring.classCount} 个班级`} />
          <StatCard compact icon="👩‍🏫" label="老师" value={spring.teachers} />
        </StatGrid>
        <div>
          <div className="text-xs font-medium text-foreground/80 mb-2 pl-1">各班学生数</div>
          <MiniBars items={spring.byClass} />
        </div>
      </Group>

      <Group title="2026 年秋季儿童主日学">
        <StatGrid cols={2}>
          <StatCard compact icon="🍁" label="学生数" value={fallKids.total} hint={`${fallKids.classCount} 个班级`} />
          <StatCard compact icon="👩‍🏫" label="老师" value={fallKids.teachers} />
        </StatGrid>
        <div>
          <div className="text-xs font-medium text-foreground/80 mb-2 pl-1">各班学生数</div>
          <MiniBars items={fallKids.byClass} />
        </div>
      </Group>
    </div>
  );
}