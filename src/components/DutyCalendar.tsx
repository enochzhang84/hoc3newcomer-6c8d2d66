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

type Row = {
  id: string;
  schedule_type: string;
  slot_time: string;
  ppt_person: string | null;
  live_person: string | null;
  live_person_2: string | null;
  sort_order: number;
};
type Person = { id: string; name: string; is_active: boolean; sort_order: number };

const MONTHS_CN = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function sundaysOfMonth(year: number, monthIdx: number) {
  const out: Date[] = [];
  const d = new Date(year, monthIdx, 1);
  while (d.getMonth() === monthIdx) {
    if (d.getDay() === 0) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function sundaysOfYear(year: number) {
  const out: Date[] = [];
  for (let m = 0; m < 12; m++) out.push(...sundaysOfMonth(year, m));
  return out;
}

export function DutyCalendarSection() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ kind: "sunday" | "summer"; date: string } | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(false);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      (supabase as any).from("duty_schedules").select("*").gte("slot_time", `${year}-01-01`).lte("slot_time", `${year}-12-31`),
      (supabase as any).from("duty_personnel").select("*").order("sort_order"),
      (supabase as any).from("app_settings").select("key,value").in("key", ["duty_sunday_title", "duty_summer_title"]),
    ]);
    setRows((a.data ?? []) as Row[]);
    setPeople((b.data ?? []) as Person[]);
    const t: Record<string, string> = {};
    for (const r of (c.data ?? []) as { key: string; value: string | null }[]) if (r.value) t[r.key] = r.value;
    setTitles(t);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const titleOf = (kind: "sunday" | "summer") =>
    titles[kind === "sunday" ? "duty_sunday_title" : "duty_summer_title"]
    || (kind === "sunday" ? "主日崇拜轮值表" : "暑期主日学轮值表");

  async function saveTitle(kind: "sunday" | "summer", value: string) {
    const key = kind === "sunday" ? "duty_sunday_title" : "duty_summer_title";
    await (supabase as any).from("app_settings").upsert({ key, value }, { onConflict: "key" });
    setTitles((t) => ({ ...t, [key]: value }));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h2 className="font-serif text-xl">事工服侍 · 年度月历</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="size-4" /> 上一年
          </Button>
          <Input
            type="number"
            value={year}
            onChange={(e) => { const v = Number(e.target.value); if (v >= 1900 && v <= 2999) setYear(v); }}
            className="h-8 w-24 text-center"
          />
          <Button size="sm" variant="outline" onClick={() => setYear((y) => y + 1)}>
            下一年 <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setYear(now.getFullYear())}>今年</Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={() => setPeopleOpen(true)}>同工管理</Button>
          <Button size="sm" variant="outline" onClick={() => setTitlesOpen(true)}>板块名称</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> 打印 / PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(["sunday", "summer"] as const).map((kind) => (
          <DutyPanel
            key={kind}
            kind={kind}
            year={year}
            title={titleOf(kind)}
            rows={rows.filter((r) => r.schedule_type === kind)}
            people={people}
            onEdit={(date) => setEditing({ kind, date })}
            reload={load}
          />
        ))}
      </div>

      {editing && (
        <EditDialog
          year={year}
          kind={editing.kind}
          date={editing.date}
          existing={rows.find((r) => r.schedule_type === editing.kind && r.slot_time === editing.date) ?? null}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <PeopleDialog open={peopleOpen} onOpenChange={setPeopleOpen} people={people} reload={load} />
      <TitlesDialog
        open={titlesOpen}
        onOpenChange={setTitlesOpen}
        sunday={titleOf("sunday")}
        summer={titleOf("summer")}
        onSave={async (s, m) => { await saveTitle("sunday", s); await saveTitle("summer", m); setTitlesOpen(false); toast.success("已保存"); }}
      />
    </div>
  );
}

function DutyPanel({
  kind, year, title, rows, people, onEdit, reload,
}: {
  kind: "sunday" | "summer";
  year: number;
  title: string;
  rows: Row[];
  people: Person[];
  onEdit: (iso: string) => void;
  reload: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pptLabel = kind === "sunday" ? "主日PPT" : "暑期PPT";
  const liveLabel = "YouTube直播";

  const byDate = useMemo(() => {
    const m = new Map<string, Row>();
    rows.forEach((r) => { if (r.slot_time && !m.has(r.slot_time)) m.set(r.slot_time, r); });
    return m;
  }, [rows]);

  async function generateYear() {
    const sundays = sundaysOfYear(year);
    const inserts = sundays
      .map((d) => toISO(d))
      .filter((iso) => !byDate.has(iso))
      .map((iso, i) => ({ schedule_type: kind, slot_time: iso, ppt_person: null, live_person: null, live_person_2: null, sort_order: i }));
    if (!inserts.length) return toast.info("本年主日已存在");
    const { error } = await (supabase as any).from("duty_schedules").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success(`已生成 ${inserts.length} 个主日`);
    reload();
  }

  function exportExcel() {
    const data = sundaysOfYear(year).map((d) => {
      const iso = toISO(d);
      const r = byDate.get(iso);
      return {
        "时间": iso,
        [pptLabel]: r?.ppt_person ?? "",
        [`${liveLabel} 1`]: r?.live_person ?? "",
        [liveLabel]: r?.live_person_2 ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${year}`);
    XLSX.writeFile(wb, `${title}_${year}.xlsx`);
    toast.success("已导出 Excel");
  }

  async function importExcel(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!json.length) return toast.error("文件为空");
      const ops: Promise<any>[] = [];
      let count = 0;
      for (const r of json) {
        const date = String(r["时间"] ?? r["日期"] ?? "").trim();
        if (!date || !date.includes("-")) continue;
        const ppt = (String(r[pptLabel] ?? r["主日PPT"] ?? r["PPT"] ?? "").trim()) || null;
        const l1 = (String(r[`${liveLabel} 1`] ?? r["YouTube直播 1"] ?? r["直播1"] ?? "").trim()) || null;
        const l2 = (String(r[liveLabel] ?? r[`${liveLabel} 2`] ?? r["直播2"] ?? "").trim()) || null;
        const existing = byDate.get(date);
        const payload = { schedule_type: kind, slot_time: date, ppt_person: ppt, live_person: l1, live_person_2: l2 };
        if (existing) ops.push((supabase as any).from("duty_schedules").update(payload).eq("id", existing.id));
        else ops.push((supabase as any).from("duty_schedules").insert(payload));
        count++;
      }
      if (!count) return toast.error("未识别到有效数据");
      await Promise.all(ops);
      toast.success(`已导入 ${count} 条`);
      reload();
    } catch (e) {
      toast.error("导入失败: " + (e as Error).message);
    }
  }

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 print:p-0 print:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
        <h3 className="font-serif text-lg">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={generateYear}>生成全年主日</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = "";
          }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>导入</Button>
          <Button size="sm" variant="outline" onClick={exportExcel}>导出</Button>
        </div>
      </div>
      <div className="hidden print:block mb-3 text-center">
        <h3 className="text-base font-semibold">{year} 年 · {title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {MONTHS_CN.map((label, idx) => (
          <MonthCard key={idx} year={year} monthIdx={idx} label={label} byDate={byDate} onPick={onEdit} pptLabel={pptLabel} />
        ))}
      </div>
    </section>
  );
}

function MonthCard({
  year, monthIdx, label, byDate, onPick, pptLabel,
}: {
  year: number; monthIdx: number; label: string;
  byDate: Map<string, Row>;
  onPick: (iso: string) => void;
  pptLabel: string;
}) {
  const sundays = sundaysOfMonth(year, monthIdx);
  const today = toISO(new Date());
  return (
    <div className="border border-border/60 rounded-xl p-2.5 bg-background/50 print:bg-white print:border-gray-300">
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="font-medium text-sm">{label}</h4>
        <span className="text-[10px] text-muted-foreground">{sundays.length} 个主日</span>
      </div>
      <div className="space-y-1.5">
        {sundays.map((d) => {
          const iso = toISO(d);
          const r = byDate.get(iso);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              onClick={() => onPick(iso)}
              className={cn(
                "w-full text-left rounded-lg border border-border/40 px-2 py-1.5 text-xs transition hover:bg-accent/60 hover:border-primary/40",
                isToday && "ring-1 ring-primary/40 bg-primary/5",
              )}
            >
              <div className="font-medium">{d.getMonth() + 1}/{d.getDate()}</div>
              <div className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
                <div className="truncate"><span className="text-foreground/70">{pptLabel}：</span>{r?.ppt_person || <span className="opacity-40">—</span>}</div>
                <div className="truncate"><span className="text-foreground/70">直播1：</span>{r?.live_person || <span className="opacity-40">—</span>}</div>
                <div className="truncate"><span className="text-foreground/70">直播：</span>{r?.live_person_2 || <span className="opacity-40">—</span>}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditDialog({
  year, kind, date, existing, people, onClose, onSaved,
}: {
  year: number;
  kind: "sunday" | "summer";
  date: string;
  existing: Row | null;
  people: Person[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const pptLabel = kind === "sunday" ? "主日PPT" : "暑期PPT";
  const [ppt, setPpt] = useState(existing?.ppt_person ?? "");
  const [l1, setL1] = useState(existing?.live_person ?? "");
  const [l2, setL2] = useState(existing?.live_person_2 ?? "");

  const opts = useMemo(() => {
    const s = new Set(people.filter((p) => p.is_active).map((p) => p.name));
    [existing?.ppt_person, existing?.live_person, existing?.live_person_2].forEach((v) => { if (v) s.add(v); });
    return Array.from(s);
  }, [people, existing]);

  async function save() {
    const payload = {
      schedule_type: kind,
      slot_time: date,
      ppt_person: ppt.trim() || null,
      live_person: l1.trim() || null,
      live_person_2: l2.trim() || null,
    };
    const { error } = existing
      ? await (supabase as any).from("duty_schedules").update(payload).eq("id", existing.id)
      : await (supabase as any).from("duty_schedules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(`已保存 ${date}`);
    onSaved();
  }

  async function remove() {
    if (!existing) return onClose();
    if (!confirm("删除该主日的轮值安排?")) return;
    const { error } = await (supabase as any).from("duty_schedules").delete().eq("id", existing.id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    onSaved();
  }

  void year;

  const Select = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
      <option value="">—</option>
      {opts.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑轮值 · {date}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{pptLabel}</Label>
            <Select value={ppt} onChange={setPpt} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">YouTube直播 1</Label>
            <Select value={l1} onChange={setL1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">YouTube直播</Label>
            <Select value={l2} onChange={setL2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {existing && <Button variant="outline" onClick={remove} className="mr-auto text-destructive">删除</Button>}
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={save}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PeopleDialog({
  open, onOpenChange, people, reload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: Person[];
  reload: () => void;
}) {
  const [name, setName] = useState("");
  async function add() {
    const n = name.trim();
    if (!n) return;
    const next = (people[people.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await (supabase as any).from("duty_personnel").insert({ name: n, sort_order: next });
    if (error) return toast.error(error.message);
    setName("");
    reload();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>同工管理</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="同工姓名" className="h-9" />
            <Button onClick={add}>添加</Button>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border border-border/40 rounded-md px-2 py-1.5">
                <Input
                  defaultValue={p.name}
                  className="h-8"
                  onBlur={async (e) => {
                    const v = e.target.value.trim();
                    if (!v || v === p.name) return;
                    await (supabase as any).from("duty_personnel").update({ name: v }).eq("id", p.id);
                    reload();
                  }}
                />
                <label className="text-xs inline-flex items-center gap-1">
                  <input type="checkbox" defaultChecked={p.is_active} onChange={async (e) => {
                    await (supabase as any).from("duty_personnel").update({ is_active: e.target.checked }).eq("id", p.id);
                    reload();
                  }} /> 启用
                </label>
                <button className="text-muted-foreground hover:text-destructive" onClick={async () => {
                  if (!confirm(`删除 ${p.name}?`)) return;
                  await (supabase as any).from("duty_personnel").delete().eq("id", p.id);
                  reload();
                }}>
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {people.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">暂无同工</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TitlesDialog({
  open, onOpenChange, sunday, summer, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sunday: string;
  summer: string;
  onSave: (sunday: string, summer: string) => void;
}) {
  const [s, setS] = useState(sunday);
  const [m, setM] = useState(summer);
  useEffect(() => { setS(sunday); setM(summer); }, [sunday, summer, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>板块名称</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">主日崇拜板块名称</Label>
            <Input value={s} onChange={(e) => setS(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">暑期主日学板块名称</Label>
            <Input value={m} onChange={(e) => setM(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => onSave(s.trim() || "主日崇拜轮值表", m.trim() || "暑期主日学轮值表")}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}