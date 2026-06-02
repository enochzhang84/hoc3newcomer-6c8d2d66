import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, StatGrid } from "./AnalyticsPrimitives";

type ServiceEntry = { entry_date: string; ministry: string | null; service_project: string | null; worker: string | null };
type DutySchedule = { schedule_type: string; live_person: string | null; live_person_2: string | null; ppt_person: string | null };

function isMediaEntry(e: ServiceEntry): boolean {
  const hay = `${e.ministry ?? ""} ${e.service_project ?? ""}`;
  return /影音|投影|直播|音控|PPT|ppt|media|av|sound/i.test(hay);
}

function rankIcon(i: number): string {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
}

/**
 * 影音投影模块统计分析 —— 左侧只保留「主日轮值排行榜」一个核心模块。
 * 数据来源：ministry_service_entries（过滤影音/投影/直播/PPT 等关键词）+ duty_schedules（主日轮值同工兜底）。
 */
export function MediaAnalytics() {
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [duty, setDuty] = useState<DutySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [e, d] = await Promise.all([
        supabase.from("ministry_service_entries").select("entry_date,ministry,service_project,worker").order("entry_date", { ascending: false }).limit(3000),
        supabase.from("duty_schedules").select("schedule_type,live_person,live_person_2,ppt_person"),
      ]);
      setEntries(((e.data ?? []) as ServiceEntry[]).filter(isMediaEntry));
      setDuty((d.data ?? []) as DutySchedule[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;

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

  // 当前主日轮值表（兜底显示）：从 duty_schedules 聚合每位同工出现次数
  const dutyMap = new Map<string, number>();
  for (const r of duty) {
    for (const name of [r.live_person, r.live_person_2, r.ppt_person]) {
      const n = (name ?? "").trim();
      if (!n) continue;
      dutyMap.set(n, (dutyMap.get(n) ?? 0) + 1);
    }
  }
  const dutyRank = [...dutyMap.entries()]
    .map(([worker, count]) => ({ worker, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalWorkers = new Set(valid.map((e) => (e.worker as string).trim())).size;
  const monthWorkers = new Set(inMonth.map((e) => (e.worker as string).trim())).size;

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
      <Section title="🏆 主日轮值排行榜">
        <div className="space-y-3">
          <StatGrid cols={2}>
            <StatCard compact label="总同工" value={totalWorkers} />
            <StatCard compact label="本月参与" value={monthWorkers} />
          </StatGrid>
          <Section title="本月轮值 Top 10">
            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={monthRank} unit="次" /></div>
          </Section>
          <Section title={`${y} 年累计 Top 10`}>
            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={yearRank} unit="次" /></div>
          </Section>
          {dutyRank.length > 0 && (
            <Section title="当前轮值表同工出现次数">
              <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={dutyRank} unit="班" /></div>
            </Section>
          )}
        </div>
      </Section>
    </div>
  );
}