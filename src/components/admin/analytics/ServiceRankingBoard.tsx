import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, StatGrid } from "./AnalyticsPrimitives";

type ServiceEntry = {
  entry_date: string;
  ministry: string | null;
  service_project: string | null;
  worker: string | null;
};

function rankIcon(i: number): string {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
}

/**
 * 通用「服侍统计榜」 —— 数据源：ministry_service_entries
 * 通过 filterFn 决定属于哪个事工（影音 / 厨房 等）。
 */
export function ServiceRankingBoard({
  title = "🏆 服侍统计榜",
  filterFn,
}: {
  title?: string;
  filterFn: (e: ServiceEntry) => boolean;
}) {
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ministry_service_entries")
        .select("entry_date,ministry,service_project,worker")
        .order("entry_date", { ascending: false })
        .limit(3000);
      setEntries(((data ?? []) as ServiceEntry[]).filter(filterFn));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return [...map.entries()]
      .map(([worker, count]) => ({ worker, count }))
      .sort((a, b) => b.count - a.count);
  };

  const monthRank = tally(inMonth).slice(0, 10);
  const yearRank = tally(inYear).slice(0, 10);
  const totalWorkers = new Set(valid.map((e) => (e.worker as string).trim())).size;
  const monthWorkers = new Set(inMonth.map((e) => (e.worker as string).trim())).size;
  const totalServices = valid.length;

  const barItems = tally(inYear).slice(0, 12).map((it) => ({ key: it.worker, count: it.count }));

  const RankList = ({ items, unit }: { items: { worker: string; count: number }[]; unit: string }) =>
    items.length === 0 ? (
      <div className="text-xs text-muted-foreground">暂无数据</div>
    ) : (
      <ol className="space-y-1">
        {items.map((it, i) => (
          <li key={it.worker} className="flex items-center justify-between text-xs gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 text-center shrink-0">{rankIcon(i)}</span>
              <span className="truncate">{it.worker}</span>
            </span>
            <span className="tabular-nums text-foreground shrink-0">
              {it.count} {unit}
            </span>
          </li>
        ))}
      </ol>
    );

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 space-y-4">
      <h2 className="font-serif text-xl">{title}</h2>
      <StatGrid cols={3}>
        <StatCard compact label="服侍人次" value={totalServices} hint={`${y} 年累计 ${inYear.length} 次`} />
        <StatCard compact label="参与同工" value={totalWorkers} hint={`本月 ${monthWorkers} 人`} />
        <StatCard compact label="本月服侍" value={inMonth.length} />
      </StatGrid>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title={`本月服侍 Top 10 (${y}-${String(m + 1).padStart(2, "0")})`}>
          <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
            <RankList items={monthRank} unit="次" />
          </div>
        </Section>
        <Section title={`${y} 年累计 Top 10`}>
          <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
            <RankList items={yearRank} unit="次" />
          </div>
        </Section>
      </div>
      <Section title="同工服侍次数（年度柱状图）">
        <MiniBars items={barItems} />
      </Section>
    </section>
  );
}

/** 影音投影事工过滤 */
export function isMediaServiceEntry(e: ServiceEntry): boolean {
  const hay = `${e.ministry ?? ""} ${e.service_project ?? ""}`;
  return /影音|投影|直播|音控|PPT|ppt|media|av|sound/i.test(hay);
}

/** 厨房事工过滤 */
export function isKitchenServiceEntry(e: ServiceEntry): boolean {
  const hay = `${e.ministry ?? ""} ${e.service_project ?? ""}`;
  return /厨房|厨|饭|餐|烹|kitchen|meal/i.test(hay);
}