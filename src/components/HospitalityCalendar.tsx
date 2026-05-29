import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Printer, X } from "lucide-react";
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
};

const MONTHS_CN = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];
const PANEL_PREFIX = "hospitality_calendar_";
const WORKERS_KEY = "hospitality_workers_global";

const NEW_ITEM = "新人接待";
const WELCOME_ITEM = "迎宾接待";
const FRONT = "前门";
const BACK = "后门";

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function sundaysOfMonth(year: number, monthIdx: number): Date[] {
  const out: Date[] = [];
  const d = new Date(year, monthIdx, 1);
  while (d.getMonth() === monthIdx) {
    if (d.getDay() === 0) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function sundaysOfYear(year: number): Date[] {
  const out: Date[] = [];
  for (let m = 0; m < 12; m++) out.push(...sundaysOfMonth(year, m));
  return out;
}

export function HospitalityCalendarSection() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [workers, setWorkers] = useState<string[]>([]);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [workersOpen, setWorkersOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const panelKey = `${PANEL_PREFIX}${year}`;

  const load = useCallback(async () => {
    const [{ data: ents }, { data: settings }] = await Promise.all([
      (supabase as any)
        .from("hospitality_ministry_entries")
        .select("*")
        .eq("panel_key", panelKey),
      (supabase as any).from("app_settings").select("key,value").eq("key", WORKERS_KEY),
    ]);
    setEntries((ents ?? []) as Entry[]);
    const v = settings?.[0]?.value;
    if (v) {
      try { setWorkers(JSON.parse(v)); } catch { setWorkers([]); }
    }
  }, [panelKey]);

  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => {
    const m = new Map<string, Entry[]>();
    entries.forEach((e) => {
      if (!e.service_date) return;
      const arr = m.get(e.service_date) ?? [];
      arr.push(e);
      m.set(e.service_date, arr);
    });
    return m;
  }, [entries]);

  async function saveWorkers(list: string[]) {
    setWorkers(list);
    await (supabase as any).from("app_settings").upsert(
      { key: WORKERS_KEY, value: JSON.stringify(list) },
      { onConflict: "key" },
    );
  }

  async function saveDate(date: string, frontWorker: string, backWorker: string, communion: boolean) {
    const existing = byDate.get(date) ?? [];
    const findRow = (item: string) => existing.find((e) => e.service_item === item);

    const ops: Promise<any>[] = [];
    // 新人接待 / 前门
    const a = findRow(NEW_ITEM);
    if (frontWorker) {
      const payload = { panel_key: panelKey, service_date: date, service_item: NEW_ITEM, location: FRONT, worker: frontWorker, holy_communion: communion };
      if (a) ops.push((supabase as any).from("hospitality_ministry_entries").update(payload).eq("id", a.id));
      else ops.push((supabase as any).from("hospitality_ministry_entries").insert(payload));
    } else if (a) {
      ops.push((supabase as any).from("hospitality_ministry_entries").delete().eq("id", a.id));
    }
    // 迎宾接待 / 后门
    const b = findRow(WELCOME_ITEM);
    if (backWorker) {
      const payload = { panel_key: panelKey, service_date: date, service_item: WELCOME_ITEM, location: BACK, worker: backWorker, holy_communion: communion };
      if (b) ops.push((supabase as any).from("hospitality_ministry_entries").update(payload).eq("id", b.id));
      else ops.push((supabase as any).from("hospitality_ministry_entries").insert(payload));
    } else if (b) {
      ops.push((supabase as any).from("hospitality_ministry_entries").delete().eq("id", b.id));
    }
    // 如无任何同工但仍要标记圣餐
    if (!frontWorker && !backWorker && communion) {
      ops.push((supabase as any).from("hospitality_ministry_entries").insert({
        panel_key: panelKey, service_date: date, service_item: null, location: null, worker: null, holy_communion: true,
      }));
    }

    const res = await Promise.all(ops);
    const err = res.find((r: any) => r?.error)?.error;
    if (err) return toast.error(err.message);
    toast.success(`已保存 ${date}`);
    setEditingDate(null);
    load();
  }

  function exportExcel() {
    const rows = sundaysOfYear(year).map((d) => {
      const iso = toISO(d);
      const rs = byDate.get(iso) ?? [];
      const a = rs.find((r) => r.service_item === NEW_ITEM);
      const b = rs.find((r) => r.service_item === WELCOME_ITEM);
      const com = rs.some((r) => r.holy_communion);
      return {
        "日期": iso,
        "新人接待(前门)": a?.worker ?? "",
        "迎宾接待(后门)": b?.worker ?? "",
        "发放圣餐": com ? "是" : "否",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${year}年迎宾接待`);
    XLSX.writeFile(wb, `迎宾接待_${year}.xlsx`);
    toast.success("已导出 Excel");
  }

  async function importExcel(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!json.length) return toast.error("文件为空");
      const inserts: any[] = [];
      for (const r of json) {
        const date = String(r["日期"] ?? "").trim();
        if (!date || !date.includes("-")) continue;
        const a = String(r["新人接待(前门)"] ?? r["新人接待"] ?? "").trim();
        const b = String(r["迎宾接待(后门)"] ?? r["迎宾接待"] ?? "").trim();
        const com = ["是", "yes", "true", "1"].includes(String(r["发放圣餐"] ?? "").trim().toLowerCase());
        if (a) inserts.push({ panel_key: panelKey, service_date: date, service_item: NEW_ITEM, location: FRONT, worker: a, holy_communion: com });
        if (b) inserts.push({ panel_key: panelKey, service_date: date, service_item: WELCOME_ITEM, location: BACK, worker: b, holy_communion: com });
      }
      if (!inserts.length) return toast.error("无有效记录");
      const { error } = await (supabase as any).from("hospitality_ministry_entries").insert(inserts);
      if (error) return toast.error(error.message);
      toast.success(`已导入 ${inserts.length} 条`);
      load();
    } catch (e) {
      toast.error("导入失败: " + (e as Error).message);
    }
  }

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 print:p-0 print:border-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl">轮值表</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="size-4" /> 上一年
          </Button>
          <Input
            type="number"
            value={year}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 1900 && v <= 2999) setYear(v);
            }}
            className="h-8 w-24 text-center"
          />
          <Button size="sm" variant="outline" onClick={() => setYear((y) => y + 1)}>
            下一年 <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setYear(now.getFullYear())}>今年</Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={() => setWorkersOpen(true)}>同工管理</Button>
          <Button size="sm" variant="outline" onClick={exportExcel}>导出 Excel</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importExcel(f);
            e.target.value = "";
          }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>导入 Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> 打印 / PDF
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-4 text-center">
        <h2 className="text-lg font-semibold">{year} 年迎宾接待轮值表</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
        {MONTHS_CN.map((label, idx) => (
          <MonthCard
            key={idx}
            year={year}
            monthIdx={idx}
            label={label}
            byDate={byDate}
            onPick={(iso) => setEditingDate(iso)}
          />
        ))}
      </div>

      {editingDate && (
        <EditDayDialog
          date={editingDate}
          rows={byDate.get(editingDate) ?? []}
          workers={workers}
          onClose={() => setEditingDate(null)}
          onSave={saveDate}
        />
      )}

      <Dialog open={workersOpen} onOpenChange={setWorkersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>同工管理</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">同工名单（下拉菜单候选项）</Label>
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
            <AddWorkerInput onAdd={(n) => { if (!workers.includes(n)) saveWorkers([...workers, n]); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkersOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MonthCard({
  year, monthIdx, label, byDate, onPick,
}: {
  year: number; monthIdx: number; label: string;
  byDate: Map<string, Entry[]>;
  onPick: (iso: string) => void;
}) {
  const sundays = sundaysOfMonth(year, monthIdx);
  const today = toISO(new Date());

  return (
    <div className="border border-border/60 rounded-xl p-3 bg-background/50 print:bg-white print:border-gray-300">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">{label}</h3>
        <span className="text-[10px] text-muted-foreground">{sundays.length} 个主日</span>
      </div>
      <div className="space-y-1.5">
        {sundays.map((d) => {
          const iso = toISO(d);
          const rs = byDate.get(iso) ?? [];
          const a = rs.find((r) => r.service_item === NEW_ITEM);
          const b = rs.find((r) => r.service_item === WELCOME_ITEM);
          const com = rs.some((r) => r.holy_communion);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              onClick={() => onPick(iso)}
              className={cn(
                "w-full text-left rounded-lg border border-border/40 px-2.5 py-1.5 text-xs transition hover:bg-accent/60 hover:border-primary/40",
                isToday && "ring-1 ring-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{d.getMonth() + 1}/{d.getDate()}</span>
                {com && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 print:bg-transparent print:border print:border-amber-700">圣餐</span>}
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                <div className="truncate"><span className="text-foreground/70">前门：</span>{a?.worker || <span className="opacity-40">—</span>}</div>
                <div className="truncate"><span className="text-foreground/70">后门：</span>{b?.worker || <span className="opacity-40">—</span>}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditDayDialog({
  date, rows, workers, onClose, onSave,
}: {
  date: string;
  rows: Entry[];
  workers: string[];
  onClose: () => void;
  onSave: (date: string, front: string, back: string, communion: boolean) => void;
}) {
  const a = rows.find((r) => r.service_item === NEW_ITEM);
  const b = rows.find((r) => r.service_item === WELCOME_ITEM);
  const [front, setFront] = useState(a?.worker ?? "");
  const [back, setBack] = useState(b?.worker ?? "");
  const [com, setCom] = useState(rows.some((r) => r.holy_communion));

  const allOpts = useMemo(() => {
    const s = new Set(workers);
    if (a?.worker) s.add(a.worker);
    if (b?.worker) s.add(b.worker);
    return Array.from(s);
  }, [workers, a, b]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑轮值 · {date}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">新人接待（前门）</Label>
            <select value={front} onChange={(e) => setFront(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {allOpts.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">迎宾接待（后门）</Label>
            <select value={back} onChange={(e) => setBack(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {allOpts.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={com} onChange={(e) => setCom(e.target.checked)} />
            发放圣餐
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSave(date, front.trim(), back.trim(), com)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddWorkerInput({ onAdd }: { onAdd: (n: string) => void }) {
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