import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award } from "lucide-react";

type Entry = {
  id: string;
  service_date: string | null;
  service_item: string | null;
  location: string | null;
  worker: string | null;
};

const POSITIONS = [
  { label: "全部", match: () => true },
  { label: "前门新人接待", match: (e: Entry) => e.location === "前门" || e.service_item === "新人接待" },
  { label: "后门迎宾接待", match: (e: Entry) => e.location === "后门" || e.service_item === "迎宾接待" },
] as const;

const MONTHS = ["全部", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export function HospitalityRankingSection() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState<number>(0); // 0 = 全部
  const [posIdx, setPosIdx] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("hospitality_ministry_entries")
        .select("id,service_date,service_item,location,worker");
      setEntries((data ?? []) as Entry[]);
    })();
  }, []);

  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    entries.forEach((e) => { if (e.service_date) ys.add(Number(e.service_date.slice(0, 4))); });
    return Array.from(ys).sort((a, b) => b - a);
  }, [entries, now]);

  const ranking = useMemo(() => {
    const pos = POSITIONS[posIdx];
    const filtered = entries.filter((e) => {
      if (!e.worker || !e.service_date) return false;
      const d = new Date(e.service_date);
      if (d.getFullYear() !== year) return false;
      if (monthIdx > 0 && d.getMonth() + 1 !== monthIdx) return false;
      return pos.match(e);
    });
    const map = new Map<string, { name: string; count: number; last: string; months: Set<number> }>();
    for (const e of filtered) {
      const k = e.worker!;
      const cur = map.get(k) ?? { name: k, count: 0, last: "", months: new Set<number>() };
      cur.count += 1;
      if (!cur.last || (e.service_date ?? "") > cur.last) cur.last = e.service_date!;
      cur.months.add(new Date(e.service_date!).getMonth() + 1);
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || (b.last > a.last ? 1 : -1));
  }, [entries, year, monthIdx, posIdx]);

  function rankIcon(i: number) {
    if (i === 0) return <Trophy className="size-4 text-yellow-500" />;
    if (i === 1) return <Medal className="size-4 text-gray-400" />;
    if (i === 2) return <Award className="size-4 text-amber-700" />;
    return <span className="text-xs text-muted-foreground tabular-nums">#{i + 1}</span>;
  }

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-serif text-xl">接待事工排行榜</h2>
        <div className="flex gap-2 flex-wrap">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="h-8 text-xs rounded-md border border-input bg-background px-2">
            {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
          </select>
          <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}
            className="h-8 text-xs rounded-md border border-input bg-background px-2">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={posIdx} onChange={(e) => setPosIdx(Number(e.target.value))}
            className="h-8 text-xs rounded-md border border-input bg-background px-2">
            {POSITIONS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">暂无记录</p>
      ) : (
        <>
          {/* PC 表格 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground text-xs">
                  <th className="py-2 px-3 w-16">排名</th>
                  <th className="py-2 px-3">姓名</th>
                  <th className="py-2 px-3 w-24">参与次数</th>
                  <th className="py-2 px-3 w-32">最近服侍</th>
                  <th className="py-2 px-3">所属月份</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.name} className="border-b border-border/30">
                    <td className="py-2 px-3">{rankIcon(i)}</td>
                    <td className="py-2 px-3 font-medium">{r.name}</td>
                    <td className="py-2 px-3 tabular-nums">{r.count}</td>
                    <td className="py-2 px-3 text-muted-foreground">{r.last}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {Array.from(r.months).sort((a, b) => a - b).map((m) => `${m}月`).join("、")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 手机端卡片 */}
          <div className="md:hidden space-y-2">
            {ranking.map((r, i) => (
              <div key={r.name} className="border border-border/50 rounded-xl p-3 bg-background/40">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {rankIcon(i)}
                    <span className="font-medium text-sm">{r.name}</span>
                  </div>
                  <span className="text-sm tabular-nums">{r.count} 次</span>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>最近: {r.last}</span>
                  <span>月份: {Array.from(r.months).sort((a, b) => a - b).map((m) => `${m}月`).join("、")}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}