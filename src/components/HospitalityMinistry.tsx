import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  panel_key: string;
  service_date: string | null;
  service_item: string | null;
  location: string | null;
  worker: string | null;
  holy_communion: boolean;
  sort_order: number;
};

const SERVICE_ITEMS = ["新人接待", "迎宾接待"];
const LOCATIONS = ["前门", "后门"];

const DEFAULT_PANELS = [
  { key: "hospitality_q1_jan", title: "2026 第一季度迎宾接待名单 一月份" },
  { key: "hospitality_q1_feb", title: "2026 第一季度迎宾接待名单 二月份" },
  { key: "hospitality_q1_mar", title: "2026 第一季度迎宾接待名单 三月份" },
  { key: "hospitality_q2_apr", title: "2026 第二季度迎宾接待名单 四月份" },
];

export function HospitalityMinistrySection() {
  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6">
      <h2 className="font-serif text-xl mb-4">接待事工</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DEFAULT_PANELS.map((p) => (
          <HospitalityPanel key={p.key} panelKey={p.key} defaultTitle={p.title} />
        ))}
      </div>
    </section>
  );
}

function HospitalityPanel({ panelKey, defaultTitle }: { panelKey: string; defaultTitle: string }) {
  const [title, setTitle] = useState(defaultTitle);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [workers, setWorkers] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState<Date | undefined>();
  const [dateOpen, setDateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const titleKey = `${panelKey}_title`;
  const workersKey = `${panelKey}_workers`;

  const load = useCallback(async () => {
    const [{ data: ents }, { data: settings }] = await Promise.all([
      (supabase as any)
        .from("hospitality_ministry_entries")
        .select("*")
        .eq("panel_key", panelKey)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      (supabase as any).from("app_settings").select("key,value").in("key", [titleKey, workersKey]),
    ]);
    setEntries((ents ?? []) as Entry[]);
    const sMap = new Map((settings ?? []).map((s: any) => [s.key, s.value]));
    if (sMap.has(titleKey)) setTitle(String(sMap.get(titleKey) ?? defaultTitle));
    if (sMap.has(workersKey)) {
      try { setWorkers(JSON.parse(String(sMap.get(workersKey) ?? "[]"))); } catch { setWorkers([]); }
    }
  }, [panelKey, titleKey, workersKey, defaultTitle]);

  useEffect(() => { load(); }, [load]);

  async function saveTitle(v: string) {
    setTitle(v);
    await (supabase as any).from("app_settings").upsert({ key: titleKey, value: v }, { onConflict: "key" });
  }
  async function saveWorkers(list: string[]) {
    setWorkers(list);
    await (supabase as any).from("app_settings").upsert({ key: workersKey, value: JSON.stringify(list) }, { onConflict: "key" });
  }

  async function addRow() {
    const nextOrder = (entries[entries.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await (supabase as any).from("hospitality_ministry_entries").insert({
      panel_key: panelKey,
      sort_order: nextOrder,
      holy_communion: false,
    });
    if (error) return toast.error(error.message);
    load();
  }

  async function updateRow(id: string, patch: Partial<Entry>) {
    const { error } = await (supabase as any).from("hospitality_ministry_entries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function delRow(id: string) {
    if (!confirm("删除此行?")) return;
    const { error } = await (supabase as any).from("hospitality_ministry_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const filtered = filterDate
    ? entries.filter((e) => e.service_date === format(filterDate, "yyyy-MM-dd"))
    : entries;

  function exportExcel() {
    const data = filtered.map((e, i) => ({
      "序号": i + 1,
      "日期": e.service_date ?? "",
      "服侍项目": e.service_item ?? "",
      "地点": e.location ?? "",
      "同工": e.worker ?? "",
      "收发圣餐": e.holy_communion ? "是" : "否",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "接待事工");
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success(`已导出 ${data.length} 条`);
  }

  async function importExcel(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!json.length) return toast.error("文件为空");
      const baseOrder = entries[entries.length - 1]?.sort_order ?? 0;
      const norm = (v: unknown) => String(v ?? "").trim();
      const inserts = json.map((r, idx) => {
        const date = norm(r["日期"] || r["date"]);
        return {
          panel_key: panelKey,
          service_date: date ? (date.includes("-") ? date : null) : null,
          service_item: norm(r["服侍项目"] || r["项目"]) || null,
          location: norm(r["地点"]) || null,
          worker: norm(r["同工"]) || null,
          holy_communion: ["是", "yes", "true", "1"].includes(norm(r["收发圣餐"]).toLowerCase()),
          sort_order: baseOrder + idx + 1,
        };
      });
      const { error } = await (supabase as any).from("hospitality_ministry_entries").insert(inserts);
      if (error) return toast.error(error.message);
      toast.success(`已导入 ${inserts.length} 条`);
      load();
    } catch (err) {
      toast.error("导入失败: " + (err as Error).message);
    }
  }

  return (
    <div className="border border-border/50 rounded-xl p-4 bg-background/40">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="font-medium text-sm">{title}</h3>
        {filterDate && (
          <button onClick={() => setFilterDate(undefined)} className="text-xs text-muted-foreground hover:text-foreground">
            清除筛选 ({format(filterDate, "MM/dd", { locale: zhCN })})
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left border-b border-border/60 text-muted-foreground">
              <th className="py-1.5 px-2 w-24">日期</th>
              <th className="py-1.5 px-2">服侍项目</th>
              <th className="py-1.5 px-2 w-20">地点</th>
              <th className="py-1.5 px-2 w-24">同工</th>
              <th className="py-1.5 px-2 w-20">收发圣餐</th>
              <th className="py-1.5 px-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border/30">
                <td className="py-1 px-1">
                  <Input type="date" defaultValue={e.service_date ?? ""} onBlur={(ev) => {
                    const v = ev.target.value || null;
                    if (v !== e.service_date) updateRow(e.id, { service_date: v });
                  }} className="h-7 text-xs" />
                </td>
                <td className="py-1 px-1">
                  <select
                    value={e.service_item ?? ""}
                    onChange={(ev) => updateRow(e.id, { service_item: ev.target.value || null })}
                    className="h-7 text-xs w-full rounded-md border border-input bg-background px-2"
                  >
                    <option value="">—</option>
                    {SERVICE_ITEMS.map((s) => <option key={s} value={s}>{s}</option>)}
                    {e.service_item && !SERVICE_ITEMS.includes(e.service_item) && <option value={e.service_item}>{e.service_item}</option>}
                  </select>
                </td>
                <td className="py-1 px-1">
                  <select
                    value={e.location ?? ""}
                    onChange={(ev) => updateRow(e.id, { location: ev.target.value || null })}
                    className="h-7 text-xs w-full rounded-md border border-input bg-background px-2"
                  >
                    <option value="">—</option>
                    {LOCATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    {e.location && !LOCATIONS.includes(e.location) && <option value={e.location}>{e.location}</option>}
                  </select>
                </td>
                <td className="py-1 px-1">
                  <select
                    value={e.worker ?? ""}
                    onChange={(ev) => updateRow(e.id, { worker: ev.target.value || null })}
                    className="h-7 text-xs w-full rounded-md border border-input bg-background px-2"
                  >
                    <option value="">—</option>
                    {workers.map((w) => <option key={w} value={w}>{w}</option>)}
                    {e.worker && !workers.includes(e.worker) && <option value={e.worker}>{e.worker}</option>}
                  </select>
                </td>
                <td className="py-1 px-1">
                  <select
                    value={e.holy_communion ? "yes" : "no"}
                    onChange={(ev) => updateRow(e.id, { holy_communion: ev.target.value === "yes" })}
                    className="h-7 text-xs w-full rounded-md border border-input bg-background px-2"
                  >
                    <option value="no">否</option>
                    <option value="yes">是</option>
                  </select>
                </td>
                <td className="py-1 px-1 text-right">
                  <button onClick={() => delRow(e.id)} className="text-destructive hover:underline text-xs">×</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">暂无记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>设置</Button>
        <Button size="sm" variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>导出 Excel</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f) importExcel(f);
          ev.target.value = "";
        }} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>导入 Excel</Button>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className={cn("gap-1", filterDate && "text-primary")}>
              <CalendarIcon className="size-4" />
              {filterDate ? format(filterDate, "MM/dd") : "日期筛选"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={filterDate} onSelect={(d) => { setFilterDate(d); setDateOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>面板设置</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">标题</Label>
              <Input defaultValue={title} onBlur={(ev) => {
                const v = ev.target.value.trim();
                if (v && v !== title) saveTitle(v);
              }} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">同工列表（下拉菜单候选项）</Label>
              <div className="flex flex-wrap gap-1.5">
                {workers.map((w) => (
                  <span key={w} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs">
                    {w}
                    <button onClick={() => saveWorkers(workers.filter((x) => x !== w))} className="text-muted-foreground hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {workers.length === 0 && <span className="text-xs text-muted-foreground">暂无</span>}
              </div>
              <AddWorkerInput onAdd={(name) => {
                if (workers.includes(name)) return;
                saveWorkers([...workers, name]);
              }} />
            </div>
            <div>
              <Button size="sm" onClick={() => { addRow(); }}>+ 添加一条记录</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddWorkerInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="同工姓名" className="h-8 text-xs" />
      <Button size="sm" variant="outline" onClick={() => {
        const n = v.trim();
        if (!n) return;
        onAdd(n);
        setV("");
      }}>添加</Button>
    </div>
  );
}