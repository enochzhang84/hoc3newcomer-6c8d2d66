import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

type Entry = {
  id: string;
  service_date: string | null;
  service_item: string | null;
  location: string | null;
  worker: string | null;
  holy_communion?: boolean | null;
};

const MONTHS = ["全部", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const PIE_COLORS = ["#d4a373", "#a98467", "#6c584c", "#e9c46a", "#bc6c25", "#dda15e", "#606c38", "#283618"];

function isFront(e: Entry) { return e.location === "前门" || e.service_item === "新人接待"; }
function isBack(e: Entry) { return e.location === "后门" || e.service_item === "迎宾接待"; }

function rankIcon(i: number) {
  if (i === 0) return <Trophy className="size-4 text-yellow-500" />;
  if (i === 1) return <Medal className="size-4 text-gray-400" />;
  if (i === 2) return <Award className="size-4 text-amber-700" />;
  return <span className="text-xs text-muted-foreground tabular-nums">#{i + 1}</span>;
}

function tally(entries: Entry[], keyFn: (e: Entry) => string | null) {
  const m = new Map<string, number>();
  for (const e of entries) {
    const k = keyFn(e);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function HospitalityRankingSection() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState<number>(0); // 0 = 全年
  const [workerFilter, setWorkerFilter] = useState<string>("__all__");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("hospitality_ministry_entries")
        .select("id,service_date,service_item,location,worker,holy_communion");
      setEntries((data ?? []) as Entry[]);
    })();
  }, []);

  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    entries.forEach((e) => { if (e.service_date) ys.add(Number(e.service_date.slice(0, 4))); });
    return Array.from(ys).sort((a, b) => b - a);
  }, [entries, now]);

  const yearEntries = useMemo(
    () => entries.filter((e) => e.service_date && Number(e.service_date.slice(0, 4)) === year),
    [entries, year],
  );

  const allWorkers = useMemo(() => {
    const s = new Set<string>();
    yearEntries.forEach((e) => { if (e.worker) s.add(e.worker); });
    return Array.from(s).sort();
  }, [yearEntries]);

  const scoped = useMemo(() => {
    return yearEntries.filter((e) => {
      if (monthIdx > 0) {
        const m = Number((e.service_date ?? "").slice(5, 7));
        if (m !== monthIdx) return false;
      }
      if (workerFilter !== "__all__" && e.worker !== workerFilter) return false;
      return true;
    });
  }, [yearEntries, monthIdx, workerFilter]);

  // ── Rankings ─────────────────────────────
  const yearRank = useMemo(() => tally(scoped, (e) => e.worker), [scoped]);
  const monthRank = useMemo(() => {
    const m = monthIdx > 0 ? monthIdx : (now.getMonth() + 1);
    const filtered = scoped.filter((e) => Number((e.service_date ?? "").slice(5, 7)) === m);
    return { month: m, list: tally(filtered, (e) => e.worker) };
  }, [scoped, monthIdx, now]);
  const frontRank = useMemo(() => tally(scoped.filter(isFront), (e) => e.worker), [scoped]);
  const backRank = useMemo(() => tally(scoped.filter(isBack), (e) => e.worker), [scoped]);
  const communionRank = useMemo(
    () => tally(scoped.filter((e) => e.holy_communion && e.worker), (e) => e.worker),
    [scoped],
  );

  // ── Fairness ─────────────────────────────
  const fairness = useMemo(() => {
    const counts = yearRank.map((r) => r.count);
    if (counts.length === 0) return { stddev: 0, min: 0, max: 0, avg: 0, gini: 0, score: 0 };
    const sum = counts.reduce((a, b) => a + b, 0);
    const avg = sum / counts.length;
    const variance = counts.reduce((a, c) => a + (c - avg) ** 2, 0) / counts.length;
    const stddev = Math.sqrt(variance);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    // Gini coefficient
    const sorted = [...counts].sort((a, b) => a - b);
    let gSum = 0;
    sorted.forEach((c, i) => { gSum += (2 * (i + 1) - sorted.length - 1) * c; });
    const gini = sum > 0 ? gSum / (sorted.length * sum) : 0;
    const score = Math.max(0, Math.round((1 - Math.abs(gini)) * 100));
    return { stddev, min, max, avg, gini, score };
  }, [yearRank]);

  // ── Report ───────────────────────────────
  const report = useMemo(() => {
    const sundays = new Set(scoped.map((e) => e.service_date));
    const communionSundays = new Set(scoped.filter((e) => e.holy_communion).map((e) => e.service_date));
    return {
      sundays: sundays.size,
      services: scoped.filter((e) => e.worker).length,
      workers: new Set(scoped.map((e) => e.worker).filter(Boolean)).size,
      communion: communionSundays.size,
      front: scoped.filter((e) => isFront(e) && e.worker).length,
      back: scoped.filter((e) => isBack(e) && e.worker).length,
    };
  }, [scoped]);

  const pieData = useMemo(() => ([
    { name: "新人接待 (前门)", value: report.front },
    { name: "迎宾接待 (后门)", value: report.back },
  ]), [report]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const sheets: [string, any[]][] = [
      ["年度排行", yearRank.map((r, i) => ({ 排名: i + 1, 姓名: r.name, 次数: r.count }))],
      [`${monthRank.month}月排行`, monthRank.list.map((r, i) => ({ 排名: i + 1, 姓名: r.name, 次数: r.count }))],
      ["新人接待", frontRank.map((r, i) => ({ 排名: i + 1, 姓名: r.name, 次数: r.count }))],
      ["迎宾接待", backRank.map((r, i) => ({ 排名: i + 1, 姓名: r.name, 次数: r.count }))],
      ["圣餐发放", communionRank.map((r, i) => ({ 排名: i + 1, 姓名: r.name, 次数: r.count }))],
      ["年度报告", [{
        年份: year, 主日数: report.sundays, 服侍人次: report.services,
        参与同工: report.workers, 圣餐次数: report.communion,
        新人接待: report.front, 迎宾接待: report.back,
        平均: fairness.avg.toFixed(2), 标准差: fairness.stddev.toFixed(2),
        公平度: fairness.score,
      }]],
    ];
    for (const [name, data] of sheets) {
      const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
    XLSX.writeFile(wb, `服侍统计_${year}.xlsx`);
  }

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h2 className="font-serif text-xl">服侍统计中心</h2>
          <p className="text-xs text-muted-foreground mt-1">数据自动从轮值表读取 · 无需重复录入</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="h-8 text-xs rounded-md border border-input bg-background px-2">
            {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
          </select>
          <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}
            className="h-8 text-xs rounded-md border border-input bg-background px-2">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}
            className="h-8 text-xs rounded-md border border-input bg-background px-2">
            <option value="__all__">全部同工</option>
            {allWorkers.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={exportExcel}>
            <Download className="size-4" /> 导出 Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> 打印 / PDF
          </Button>
        </div>
      </div>

      {/* 年度报告 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">📊 {year} 年度事工报告</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "主日数", value: report.sundays },
            { label: "服侍人次", value: report.services },
            { label: "参与同工", value: report.workers },
            { label: "圣餐次数", value: report.communion },
            { label: "新人接待", value: report.front },
            { label: "迎宾接待", value: report.back },
          ].map((s) => (
            <div key={s.label} className="border border-border/50 rounded-xl p-3 bg-background/40">
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-border/50 rounded-xl p-4 bg-background/40">
          <h3 className="text-sm font-medium mb-2">同工服侍次数 (柱状图)</h3>
          {yearRank.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={yearRank.slice(0, 12)}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#bc6c25" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="border border-border/50 rounded-xl p-4 bg-background/40">
          <h3 className="text-sm font-medium mb-2">前门 / 后门 分布 (饼图)</h3>
          {report.front + report.back === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Rankings grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <RankCard title="🏆 年度服侍排行" subtitle={`${year} 年`} list={yearRank} />
        <RankCard title="📅 月度服侍排行" subtitle={`${monthRank.month} 月`} list={monthRank.list} />
        <RankCard title="🚪 新人接待 (前门)" list={frontRank} />
        <RankCard title="🤝 迎宾接待 (后门)" list={backRank} />
        <RankCard title="🍞 圣餐发放" list={communionRank} />
        <FairnessCard fairness={fairness} count={yearRank.length} />
      </div>
    </section>
  );
}

function RankCard({ title, subtitle, list }: { title: string; subtitle?: string; list: { name: string; count: number }[] }) {
  return (
    <div className="border border-border/50 rounded-xl p-4 bg-background/40">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">暂无记录</p>
      ) : (
        <ul className="space-y-1">
          {list.slice(0, 10).map((r, i) => (
            <li key={r.name} className="flex items-center justify-between text-sm py-1 border-b border-border/20 last:border-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-6 flex justify-center">{rankIcon(i)}</span>
                <span className="truncate">{r.name}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">{r.count} 次</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FairnessCard({ fairness, count }: { fairness: { stddev: number; min: number; max: number; avg: number; score: number }; count: number }) {
  const tone = fairness.score >= 80 ? "text-emerald-600" : fairness.score >= 60 ? "text-amber-600" : "text-rose-600";
  return (
    <div className="border border-border/50 rounded-xl p-4 bg-background/40">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-medium">⚖️ 服侍公平度分析</h3>
        <span className="text-[11px] text-muted-foreground">{count} 位同工</span>
      </div>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">暂无数据</p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-semibold tabular-nums ${tone}`}>{fairness.score}</span>
            <span className="text-xs text-muted-foreground">/ 100 公平度分</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
            <div>平均次数: <span className="text-foreground tabular-nums">{fairness.avg.toFixed(1)}</span></div>
            <div>标准差: <span className="text-foreground tabular-nums">{fairness.stddev.toFixed(2)}</span></div>
            <div>最多: <span className="text-foreground tabular-nums">{fairness.max} 次</span></div>
            <div>最少: <span className="text-foreground tabular-nums">{fairness.min} 次</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            分数越高代表同工之间的服侍次数越均衡。
          </p>
        </div>
      )}
    </div>
  );
}