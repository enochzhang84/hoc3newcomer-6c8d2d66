import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";

type Checkin = { name: string | null; fellowship: string | null; contact: string | null; checkin_date: string };

export function LongAbsenceDialog({
  open,
  onOpenChange,
  checkins,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  checkins: Checkin[];
}) {
  const [tab, setTab] = useState<"4" | "8" | "12">("4");
  const [q, setQ] = useState("");

  const latestPerName = useMemo(() => {
    const m = new Map<string, { name: string; date: Date; fellowship: string | null; contact: string | null }>();
    checkins.forEach((c) => {
      const n = c.name?.trim();
      if (!n) return;
      const d = new Date(c.checkin_date);
      const prev = m.get(n);
      if (!prev || d > prev.date) m.set(n, { name: n, date: d, fellowship: c.fellowship, contact: c.contact });
    });
    return m;
  }, [checkins]);

  const buckets = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const out: Record<"4" | "8" | "12", typeof rows> = { "4": [], "8": [], "12": [] };
    type Row = { name: string; lastDate: string; weeksAgo: number; fellowship: string | null; contact: string | null };
    const rows: Row[] = [];
    latestPerName.forEach((v) => {
      const weeksAgo = Math.floor((now - v.date.getTime()) / week);
      if (weeksAgo >= 4) {
        rows.push({
          name: v.name,
          lastDate: v.date.toISOString().slice(0, 10),
          weeksAgo,
          fellowship: v.fellowship,
          contact: v.contact,
        });
      }
    });
    rows.sort((a, b) => b.weeksAgo - a.weeksAgo);
    out["4"] = rows.filter((r) => r.weeksAgo >= 4 && r.weeksAgo < 8);
    out["8"] = rows.filter((r) => r.weeksAgo >= 8 && r.weeksAgo < 12);
    out["12"] = rows.filter((r) => r.weeksAgo >= 12);
    return out;
  }, [latestPerName]);

  const filtered = (rows: typeof buckets["4"]) =>
    q.trim() ? rows.filter((r) => (r.name + (r.fellowship ?? "") + (r.contact ?? "")).includes(q.trim())) : rows;

  const exportAll = () => {
    const all = [...buckets["4"], ...buckets["8"], ...buckets["12"]].map((r) => ({
      姓名: r.name,
      团契: r.fellowship ?? "",
      联系方式: r.contact ?? "",
      最近签到: r.lastDate,
      缺席周数: r.weeksAgo,
    }));
    const ws = XLSX.utils.json_to_sheet(all);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "长期缺席");
    XLSX.writeFile(wb, `长期缺席名单_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚠️ 长期缺席名单（基于团契签到）</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Input
            placeholder="搜索姓名 / 团契 / 联系方式"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={exportAll}>📊 导出 Excel</Button>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="4">4–7 周 ({buckets["4"].length})</TabsTrigger>
            <TabsTrigger value="8">8–11 周 ({buckets["8"].length})</TabsTrigger>
            <TabsTrigger value="12">≥12 周 ({buckets["12"].length})</TabsTrigger>
          </TabsList>
          {(["4", "8", "12"] as const).map((k) => (
            <TabsContent key={k} value={k} className="mt-3">
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">姓名</th>
                      <th className="text-left p-2">团契</th>
                      <th className="text-left p-2">联系方式</th>
                      <th className="text-left p-2">最近签到</th>
                      <th className="text-left p-2">缺席</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered(buckets[k]).length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">无记录</td></tr>
                    )}
                    {filtered(buckets[k]).map((r) => (
                      <tr key={r.name} className="border-t border-border/30">
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">{r.fellowship ?? "—"}</td>
                        <td className="p-2">{r.contact ?? "—"}</td>
                        <td className="p-2">{r.lastDate}</td>
                        <td className="p-2">{r.weeksAgo} 周</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}