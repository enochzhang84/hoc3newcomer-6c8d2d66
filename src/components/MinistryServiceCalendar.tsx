import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ChevronLeft, ChevronRight, Settings2, Download, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Ministry = { id: string; name: string; sort_order: number; is_active: boolean };
type ServiceProject = { id: string; name: string; ministry_id: string | null; sort_order: number; is_active: boolean };
type Entry = {
  id: string;
  entry_date: string;
  ministry: string | null;
  service_project: string | null;
  worker: string | null;
  notes: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayISO = () => { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()); };

export default function MinistryServiceCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const monthStart = useMemo(() => toISO(year, month, 1), [year, month]);
  const monthEnd = useMemo(() => {
    const last = new Date(year, month + 1, 0).getDate();
    return toISO(year, month, last);
  }, [year, month]);

  const load = useCallback(async () => {
    const [{ data: m }, { data: p }, { data: e }] = await Promise.all([
      supabase.from("ministries").select("*").order("sort_order"),
      supabase.from("service_projects").select("*").order("sort_order"),
      supabase.from("ministry_service_entries").select("*")
        .gte("entry_date", monthStart).lte("entry_date", monthEnd)
        .order("entry_date"),
    ]);
    setMinistries((m as Ministry[]) ?? []);
    setProjects((p as ServiceProject[]) ?? []);
    setEntries((e as Entry[]) ?? []);
  }, [monthStart, monthEnd]);

  useEffect(() => { void load(); }, [load]);

  const entriesByDate = useMemo(() => {
    const m: Record<string, Entry[]> = {};
    for (const e of entries) (m[e.entry_date] ??= []).push(e);
    return m;
  }, [entries]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysIn = new Date(year, month + 1, 0).getDate();
    const arr: { date: string | null; day: number }[] = [];
    for (let i = 0; i < startDow; i++) arr.push({ date: null, day: 0 });
    for (let d = 1; d <= daysIn; d++) arr.push({ date: toISO(year, month, d), day: d });
    while (arr.length % 7 !== 0) arr.push({ date: null, day: 0 });
    return arr;
  }, [year, month]);

  const goPrev = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); };
  const goNext = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); };

  const exportXlsx = async (scope: "month" | "all") => {
    let rows: Entry[] = [];
    if (scope === "month") rows = entries.slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    else {
      const { data } = await supabase.from("ministry_service_entries").select("*").order("entry_date");
      rows = (data as Entry[]) ?? [];
    }
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      日期: r.entry_date,
      事工: r.ministry ?? "",
      服侍项目: r.service_project ?? "",
      服侍同工: r.worker ?? "",
      备注: r.notes ?? "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "事工服侍");
    const fname = scope === "month" ? `事工服侍_${year}-${pad(month + 1)}.xlsx` : `事工服侍_全部.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  const openCreate = (date: string) => {
    setEditDate(date);
    setEditEntry({ id: "", entry_date: date, ministry: null, service_project: null, worker: null, notes: null });
  };

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-serif text-xl">事工服侍</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
          <select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
            {Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i).map((y) => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
          <select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
            {Array.from({ length: 12 }, (_, i) => i).map((m) => (
              <option key={m} value={m}>{m + 1} 月</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth()); }}>今天</Button>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4 mr-1" />设置
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportXlsx("month")}>
            <Download className="w-4 h-4 mr-1" />本月
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportXlsx("all")}>
            <Download className="w-4 h-4 mr-1" />全部
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs sm:text-sm text-muted-foreground border-b border-border/50 mb-1">
        {weekdays.map((w) => <div key={w} className="py-2 text-center font-medium">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-square sm:aspect-[4/3] bg-muted/20 rounded-md" />;
          const dayEntries = entriesByDate[c.date] ?? [];
          const isToday = c.date === todayISO();
          return (
            <div
              key={i}
              onClick={() => openCreate(c.date!)}
              className={cn(
                "aspect-square sm:aspect-[4/3] min-h-[72px] rounded-md border text-left p-1.5 sm:p-2 flex flex-col gap-0.5 transition-all hover:border-primary/60 hover:bg-primary/5 cursor-pointer overflow-hidden",
                isToday ? "border-primary bg-primary/10" : "border-border/50 bg-background",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs sm:text-sm font-medium", isToday && "text-primary")}>{c.day}</span>
                {dayEntries.length > 0 && (
                  <span className="text-[10px] text-primary font-medium">{dayEntries.length}</span>
                )}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayEntries.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); setEditDate(c.date); setEditEntry(e); }}
                    className="text-[10px] sm:text-xs leading-tight truncate px-1 py-0.5 rounded bg-primary/10 hover:bg-primary/20"
                    title={`${e.ministry ?? ""} ${e.service_project ?? ""} ${e.worker ?? ""}`}
                  >
                    {e.worker || e.service_project || e.ministry || "—"}
                  </div>
                ))}
                {dayEntries.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{dayEntries.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editDate} onOpenChange={(o) => { if (!o) { setEditDate(null); setEditEntry(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editDate} · 事工服侍</DialogTitle>
          </DialogHeader>
          {editDate && (
            <EntryEditor
              entry={editEntry ?? { id: "", entry_date: editDate, ministry: null, service_project: null, worker: null, notes: null }}
              ministries={ministries}
              projects={projects}
              dayEntries={entriesByDate[editDate] ?? []}
              onPickEntry={setEditEntry}
              onNew={() => setEditEntry({ id: "", entry_date: editDate, ministry: null, service_project: null, worker: null, notes: null })}
              onSaved={() => { setEditDate(null); setEditEntry(null); load(); }}
              onDeleted={() => { setEditDate(null); setEditEntry(null); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>事工 / 服侍项目设置</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-6">
            <ListEditor
              title="事工"
              items={ministries.map((m) => ({ id: m.id, name: m.name }))}
              onAdd={async (name) => {
                await supabase.from("ministries").insert({ name, sort_order: (ministries.at(-1)?.sort_order ?? 0) + 1 });
                load();
              }}
              onUpdate={async (id, name) => { await supabase.from("ministries").update({ name }).eq("id", id); load(); }}
              onDelete={async (id) => { await supabase.from("ministries").delete().eq("id", id); load(); }}
            />
            <ListEditor
              title="服侍项目"
              items={projects.map((p) => ({
                id: p.id,
                name: p.name,
                extra: p.ministry_id ? ministries.find((m) => m.id === p.ministry_id)?.name : "",
              }))}
              extraSlot={(id) => (
                <select
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                  defaultValue={projects.find((p) => p.id === id)?.ministry_id ?? ""}
                  onChange={async (e) => {
                    await supabase.from("service_projects").update({ ministry_id: e.target.value || null }).eq("id", id);
                    load();
                  }}
                >
                  <option value="">未关联事工</option>
                  {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              onAdd={async (name) => {
                await supabase.from("service_projects").insert({ name, sort_order: (projects.at(-1)?.sort_order ?? 0) + 1 });
                load();
              }}
              onUpdate={async (id, name) => { await supabase.from("service_projects").update({ name }).eq("id", id); load(); }}
              onDelete={async (id) => { await supabase.from("service_projects").delete().eq("id", id); load(); }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EntryEditor({
  entry, ministries, projects, dayEntries, onPickEntry, onNew, onSaved, onDeleted,
}: {
  entry: Entry;
  ministries: Ministry[];
  projects: ServiceProject[];
  dayEntries: Entry[];
  onPickEntry: (e: Entry) => void;
  onNew: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [ministry, setMinistry] = useState(entry.ministry ?? "");
  const [project, setProject] = useState(entry.service_project ?? "");
  const [worker, setWorker] = useState(entry.worker ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");

  useEffect(() => {
    setMinistry(entry.ministry ?? "");
    setProject(entry.service_project ?? "");
    setWorker(entry.worker ?? "");
    setNotes(entry.notes ?? "");
  }, [entry.id, entry.entry_date]);

  const filteredProjects = useMemo(() => {
    const m = ministries.find((x) => x.name === ministry);
    if (!m) return projects.filter((p) => p.is_active);
    return projects.filter((p) => p.is_active && (!p.ministry_id || p.ministry_id === m.id));
  }, [ministry, ministries, projects]);

  const save = async () => {
    const payload = {
      entry_date: entry.entry_date,
      ministry: ministry || null,
      service_project: project || null,
      worker: worker || null,
      notes: notes || null,
    };
    if (entry.id) {
      const { error } = await supabase.from("ministry_service_entries").update(payload).eq("id", entry.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("ministry_service_entries").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("已保存");
    onSaved();
  };

  return (
    <div className="space-y-3">
      {dayEntries.length > 0 && (
        <div className="flex flex-wrap gap-1 pb-2 border-b">
          {dayEntries.map((e) => (
            <button
              key={e.id}
              onClick={() => onPickEntry(e)}
              className={cn(
                "text-xs px-2 py-1 rounded border",
                e.id === entry.id ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted",
              )}
            >
              {e.worker || e.service_project || e.ministry || "—"}
            </button>
          ))}
          <button onClick={onNew} className="text-xs px-2 py-1 rounded border border-dashed hover:bg-muted flex items-center gap-1">
            <Plus className="w-3 h-3" />新建
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>事工</Label>
          <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={ministry} onChange={(e) => setMinistry(e.target.value)}>
            <option value="">—</option>
            {ministries.filter((m) => m.is_active).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <Label>服侍项目</Label>
          <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">—</option>
            {filteredProjects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label>服侍同工</Label>
        <Input value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="可填多人，用 / 分隔" />
      </div>
      <div>
        <Label>备注</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <DialogFooter>
        {entry.id && (
          <Button variant="ghost" className="text-destructive" onClick={async () => {
            if (!confirm("删除该记录?")) return;
            await supabase.from("ministry_service_entries").delete().eq("id", entry.id);
            toast.success("已删除"); onDeleted();
          }}>删除</Button>
        )}
        <Button onClick={save}>保存</Button>
      </DialogFooter>
    </div>
  );
}

function ListEditor({
  title, items, onAdd, onUpdate, onDelete, extraSlot,
}: {
  title: string;
  items: { id: string; name: string; extra?: string }[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  extraSlot?: (id: string) => React.ReactNode;
}) {
  const [newName, setNewName] = useState("");
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-1">
            <Input
              defaultValue={it.name}
              className="h-8"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== it.name) void onUpdate(it.id, v); }}
            />
            {extraSlot?.(it.id)}
            <Button size="sm" variant="ghost" onClick={async () => { if (confirm("删除?")) await onDelete(it.id); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-1 pt-2">
        <Input className="h-8" placeholder={`新增${title}`} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button size="sm" onClick={async () => { const v = newName.trim(); if (!v) return; await onAdd(v); setNewName(""); }}>添加</Button>
      </div>
    </div>
  );
}