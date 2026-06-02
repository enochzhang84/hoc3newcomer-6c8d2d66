import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 迎宾接待 · 数据统计
 * 完整复用 /data-preview「数据统计 → 新人」整页布局：
 * - 顶部 4 张大卡片
 * - 中间 2/3/6 列 StatBreakdown 卡片
 * - 含趋势 / 条形图 / 排行榜 / 男女比 同款样式
 */
type Entry = {
  id: string;
  service_date: string | null;
  worker: string | null;
  panel_key: string;
  service_item: string | null;
  location: string | null;
  holy_communion: boolean | null;
  created_at: string;
};

export function WelcomeAnalytics() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("hospitality_ministry_entries")
        .select("id,service_date,worker,panel_key,service_item,location,holy_communion,created_at")
        .order("service_date", { ascending: false })
        .limit(2000);
      setItems((data ?? []) as Entry[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-center text-muted-foreground py-12">加载中...</p>;

  const dated = items.filter((x) => !!x.service_date);
  const sow = startOfWeek();
  const psow = prevStartOfWeek();
  const som = startOfMonth();
  const psom = prevStartOfMonth();

  const thisWeek = countBetween(dated, sow, addDays(sow, 7));
  const lastWeek = countBetween(dated, psow, sow);
  const thisMonth = countSince(dated, som);
  const lastMonth = countBetween(dated, psom, som);

  const totalWorkers = new Set(items.filter((x) => x.worker?.trim()).map((x) => x.worker!.trim())).size;
  const monthItems = dated.filter((x) => new Date(x.service_date!) >= som);
  const matchHay = (e: Entry, re: RegExp) =>
    re.test(`${e.panel_key} ${e.service_item ?? ""} ${e.location ?? ""}`);
  const newcomerCount = items.filter((e) => matchHay(e, /新人|newcomer|迎新/i)).length;
  const holyCount = items.filter((e) => e.holy_communion).length;

  return (
    <div className="space-y-4">
      {/* 顶部 4 个大卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="总接待记录" value={items.length} />
        <Stat label="新人接待" value={newcomerCount} />
        <Stat label="圣餐服侍" value={holyCount} />
        <Stat label="迎宾同工" value={totalWorkers} />
      </div>

      {/* 第二组：6+ 列拆解 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBreakdown
          label="本周接待"
          total={thisWeek + lastWeek}
          items={[{ key: "本周", count: thisWeek }, { key: "上周", count: lastWeek }]}
          trend={thisWeek - lastWeek}
          chart
        />
        <StatBreakdown
          label="本月接待"
          total={thisMonth + lastMonth}
          items={[{ key: "本月", count: thisMonth }, { key: "上月", count: lastMonth }]}
          trend={thisMonth - lastMonth}
          chart
        />
        <StatBreakdown
          label="按项目分布"
          total={items.length}
          items={groupCounts(items, (e) => e.panel_key || "其他")}
          chart
        />
        <StatBreakdown
          label="按地点"
          total={items.filter((e) => e.location?.trim()).length}
          items={groupCounts(items.filter((e) => e.location?.trim()), (e) => e.location!.trim())}
          chart
        />
        <StatBreakdown
          label="按服侍项目"
          total={items.filter((e) => e.service_item?.trim()).length}
          items={groupCounts(items.filter((e) => e.service_item?.trim()), (e) => e.service_item!.trim())}
          chart
        />
        <StatBreakdown
          label="圣餐 / 普通"
          total={items.length}
          items={[
            { key: "圣餐", count: holyCount },
            { key: "普通", count: items.length - holyCount },
          ]}
          chart
        />
        <StatBreakdown
          label="同工排行（累计）"
          total={items.filter((e) => e.worker?.trim()).length}
          items={groupCounts(items.filter((e) => e.worker?.trim()), (e) => e.worker!.trim())}
          rank
        />
        <StatBreakdown
          label="本月同工排行"
          total={monthItems.filter((e) => e.worker?.trim()).length}
          items={groupCounts(monthItems.filter((e) => e.worker?.trim()), (e) => e.worker!.trim())}
          rank
        />
      </div>
    </div>
  );
}

/* ============ 与 /data-preview 完全一致的子组件 ============ */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col justify-center">
      <div className="text-3xl font-serif text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function StatBreakdown({
  label, total, items, trend, chart, rank,
}: {
  label: string;
  total: number;
  items?: { key: string; count: number }[];
  trend?: number;
  chart?: boolean;
  rank?: boolean;
}) {
  const max = items && items.length > 0 ? Math.max(...items.map((i) => i.count), 1) : 1;
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col break-inside-avoid">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="text-2xl font-serif text-foreground">{total}</div>
        {typeof trend === "number" && (
          <span className={`text-xs tabular-nums ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"}`}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {trend > 0 ? "+" : ""}{trend}
          </span>
        )}
      </div>
      {items && items.length > 0 && (
        <div className="mt-3">
          {rank ? (
            <div className="space-y-1">
              {items.slice(0, 5).map((it, idx) => (
                <div key={it.key} className="flex items-center gap-2 text-sm">
                  <span className="text-base">{medals[idx] || `${idx + 1}.`}</span>
                  <span className="truncate text-foreground">{it.key}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{it.count}次</span>
                </div>
              ))}
            </div>
          ) : chart ? (
            <div className="space-y-1.5">
              {items.map((it) => (
                <div key={it.key} className="text-xs">
                  <div className="flex justify-between text-muted-foreground mb-0.5">
                    <span className="truncate pr-2">{it.key}</span>
                    <span className="text-foreground tabular-nums">
                      {it.count}
                      {total > 0 && (
                        <span className="text-muted-foreground ml-1">({Math.round((it.count / total) * 100)}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(it.count / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function startOfWeek() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff, 0, 0, 0, 0);
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function prevStartOfWeek() {
  const s = startOfWeek();
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7, 0, 0, 0, 0);
}
function prevStartOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 0, 0, 0, 0);
}
function countSince(list: Entry[], since: Date) {
  return list.filter((r) => new Date(r.service_date!) >= since).length;
}
function countBetween(list: Entry[], from: Date, to: Date) {
  return list.filter((r) => {
    const t = new Date(r.service_date!);
    return t >= from && t < to;
  }).length;
}
function groupCounts(list: Entry[], keyFn: (r: Entry) => string) {
  const map = new Map<string, number>();
  for (const r of list) {
    const k = keyFn(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}