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

const MONTHS_CN = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function sundaysOfMonth(year: number, monthIdx: number): string[] {
  const out: string[] = [];
  const d = new Date(year, monthIdx, 1);
  while (d.getMonth() === monthIdx) {
    if (d.getDay() === 0) out.push(toISO(year, monthIdx, d.getDate()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function MinistryServiceCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const yearStart = useMemo(() => toISO(year, 0, 1), [year]);
  const yearEnd = useMemo(() => toISO(year, 11, 31), [year]);

  const load = useCallback(async () => {
    const [{ data: m }, { data: p }, { data: e }] = await Promise.all([
      supabase.from("ministries").select("*").order("sort_order"),
      supabase.from("service_projects").select("*").order("sort_order"),
      supabase.from("ministry_service_entries").select("*")
        .gte("entry_date", yearStart).lte("entry_date", yearEnd)
        .order("entry_date"),
    ]);
    setMinistries((m as Ministry[]) ?? []);
    setProjects((p as ServiceProject[]) ?? []);
    setEntries((e as Entry[]) ?? []);
  }, [yearStart, yearEnd]);

  useEffect(() => { void load(); }, [load]);

  const entriesByDate = useMemo(() => {
    const m: Record<string, Entry[]> = {};
    for (const e of entries) (m[e.entry_date] ??= []).push(e);
    return m;
  }, [entries]);

  const exportXlsx = async (scope: "year" | "all") => {
    let rows: Entry[] = [];
    if (scope === "year") rows = entries.slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date));
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
    const fname = scope === "year" ? `事工服侍_${year}.xlsx` : `事工服侍_全部.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const openCreate = (date: string) => {
    setEditDate(date);
    setEditEntry({ id: "", entry_date: date, ministry: null, service_project: null, worker: null, notes: null });
  };

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-serif text-xl">事工服侍</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="w-4 h-4" /> 上一年
          </Button>
          <Input
            type="number"
            value={year}
            onChange={(e) => { const v = Number(e.target.value); if (v >= 1900 && v <= 2999) setYear(v); }}
            className="h-8 w-24 text-center"
          />
          <Button size="sm" variant="outline" onClick={() => setYear((y) => y + 1)}>
            下一年 <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setYear(now.getFullYear())}>今年</Button>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4 mr-1" />设置
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportXlsx("year")}>
            <Download className="w-4 h-4 mr-1" />本年
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportXlsx("all")}>
            <Download className="w-4 h-4 mr-1" />全部
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MONTHS_CN.map((label, idx) => {
          const sundays = sundaysOfMonth(year, idx);
          return (
            <div key={idx} className="border border-border/60 rounded-xl p-3 bg-background/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">{label}</h3>
                <span className="text-[10px] text-muted-foreground">{sundays.length} 个主日</span>
              </div>
              <div className="space-y-1.5">
                {sundays.map((iso) => {
                  const dayEntries = entriesByDate[iso] ?? [];
                  const isToday = iso === todayISO();
                  const [, mm, dd] = iso.split("-");
                  return (
                    <button
                      key={iso}
                      onClick={() => openCreate(iso)}
                      className={cn(
                        "w-full text-left rounded-lg border border-border/40 px-2.5 py-1.5 text-xs transition hover:bg-accent/60 hover:border-primary/40",
                        isToday && "ring-1 ring-primary/40 bg-primary/5",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{Number(mm)}/{Number(dd)}</span>
                        {dayEntries.length > 0 && (
                          <span className="text-[10px] text-primary font-medium">{dayEntries.length} 条</span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                        {dayEntries.slice(0, 3).map((e) => (
                          <div key={e.id} className="truncate">
                            {e.worker || e.service_project || e.ministry || "—"}
                          </div>
                        ))}
                        {dayEntries.length === 0 && <div className="opacity-40">—</div>}
                        {dayEntries.length > 3 && (
                          <div className="opacity-60">+{dayEntries.length - 3}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
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