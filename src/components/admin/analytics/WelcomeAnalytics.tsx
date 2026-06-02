import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, StatGrid, groupBy } from "./AnalyticsPrimitives";

type Entry = {
  service_date: string | null;
  worker: string | null;
  panel_key: string;
  service_item: string | null;
  location: string | null;
};

function rankIcon(i: number): string {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
}

/** 复用首页统计卡片风格的「迎宾接待」左侧统计区。 */
export function WelcomeAnalytics() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("hospitality_ministry_entries")
        .select("service_date,worker,panel_key,service_item,location")
        .order("service_date", { ascending: false })
        .limit(2000);
      setItems((data ?? []) as Entry[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.toISOString().slice(0, 10);
  const startOfWeek = new Date(now);
  const dow = (startOfWeek.getDay() + 6) % 7; // 周一起
  startOfWeek.setDate(startOfWeek.getDate() - dow);
  startOfWeek.setHours(0, 0, 0, 0);

  const dated = items.filter((x) => !!x.service_date);
  const monthItems = dated.filter((x) => {
    const d = new Date(x.service_date!);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const weekItems = dated.filter((x) => new Date(x.service_date!) >= startOfWeek);
  const todayItems = dated.filter((x) => x.service_date === today);

  const matchHay = (e: Entry, re: RegExp) =>
    re.test(`${e.panel_key} ${e.service_item ?? ""} ${e.location ?? ""}`);
  const newcomerCount = items.filter((e) => matchHay(e, /新人|newcomer|迎新/i)).length;
  const frontCount = items.filter((e) => matchHay(e, /前门|前廳|front/i)).length;
  const backCount = items.filter((e) => matchHay(e, /后门|後門|back/i)).length;

  const workersAll = new Set(items.filter((x) => x.worker?.trim()).map((x) => x.worker!.trim()));
  const workersMonth = new Set(monthItems.filter((x) => x.worker?.trim()).map((x) => x.worker!.trim()));

  // 近 8 周接待趋势
  const trendMap = new Map<string, number>();
  for (let i = 7; i >= 0; i--) {
    const start = new Date(startOfWeek);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const key = `${start.getMonth() + 1}/${start.getDate()}`;
    const c = dated.filter((x) => {
      const d = new Date(x.service_date!);
      return d >= start && d < end;
    }).length;
    trendMap.set(key, c);
  }
  const trend = [...trendMap.entries()].map(([key, count]) => ({ key, count }));

  const tally = (list: Entry[]) =>
    groupBy(list.filter((x) => x.worker?.trim()), (x) => x.worker!.trim())
      .map((g) => ({ worker: g.key, count: g.count }));

  const monthRank = tally(monthItems).slice(0, 10);
  const yearRank = tally(dated.filter((x) => new Date(x.service_date!).getFullYear() === y)).slice(0, 10);

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
    <div className="space-y-6">
      {/* 第一行：3 个大卡片 */}
      <StatGrid cols={3}>
        <StatCard icon="📅" label="本月接待" value={monthItems.length} hint={`累计 ${items.length} 次`} />
        <StatCard icon="📆" label="本周接待" value={weekItems.length} />
        <StatCard icon="🗓️" label="今日接待" value={todayItems.length} />
      </StatGrid>

      {/* 第二行：3 个分类卡片 */}
      <StatGrid cols={3}>
        <StatCard icon="🙋" label="新人接待" value={newcomerCount} />
        <StatCard icon="🚪" label="前门接待" value={frontCount} />
        <StatCard icon="🚪" label="后门接待" value={backCount} />
      </StatGrid>

      {/* 第三行：同工 + 趋势 */}
      <StatGrid cols={3}>
        <StatCard icon="👥" label="迎宾同工" value={workersAll.size} hint="累计参与人数" />
        <StatCard icon="🧑‍🤝‍🧑" label="本月同工参与" value={workersMonth.size} />
        <StatCard icon="📊" label="近 8 周总计" value={trend.reduce((s, x) => s + x.count, 0)} />
      </StatGrid>

      {/* 趋势 + 排行榜 */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Section title="近 8 周接待趋势"><MiniBars items={trend} /></Section>
        </div>
        <div>
          <Section title="🏆 本月 Top 10">
            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={monthRank} unit="次" /></div>
          </Section>
        </div>
        <div>
          <Section title={`🏆 ${y} 年累计 Top 10`}>
            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"><RankList items={yearRank} unit="次" /></div>
          </Section>
        </div>
      </div>
    </div>
  );
}