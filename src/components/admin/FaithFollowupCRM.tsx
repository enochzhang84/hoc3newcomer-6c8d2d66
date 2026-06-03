import { useMemo, useState } from "react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CalendarIcon,
  Eye,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Plus,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ---------- Types ---------- */

type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  phone: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  gender?: string | null;
  age_group?: string | null;
  marital_status?: string | null;
  source?: string | null;
  source_channel?: string | null;
  invited_by?: string | null;
  referrer_type?: string | null;
  faith: string | null;
  faith_stage: string | null;
  faith_growth_note: string | null;
  follow_up_person: string | null;
  last_followup_at: string | null;
  next_followup_at: string | null;
  created_at?: string;
};

type TimelineEntry = {
  date: string; // YYYY-MM-DD
  type: string;
  content?: string;
};

type NoteData = {
  note: string;
  timeline: TimelineEntry[];
};

/* ---------- Stages ---------- */

const STAGES = [
  "慕道友",
  "初信者",
  "受洗班",
  "决志",
  "受洗成员",
  "团契成员",
  "事工同工",
  "事工负责人",
] as const;

// Legacy values still supported (read-only display)
const LEGACY_MAP: Record<string, string> = {
  "已跟进": "初信者",
  "已受洗": "受洗成员",
};

function normStage(s: string | null): string {
  if (!s) return "慕道友";
  return LEGACY_MAP[s] ?? s;
}

const STAGE_STYLE: Record<string, { dot: string; cls: string; icon: string }> = {
  "慕道友":     { dot: "bg-orange-500",  cls: "bg-orange-500/10 text-orange-700 dark:text-orange-300",   icon: "🟠" },
  "初信者":     { dot: "bg-sky-500",     cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300",            icon: "🔵" },
  "受洗班":     { dot: "bg-amber-500",   cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300",      icon: "🟡" },
  "决志":       { dot: "bg-violet-500",  cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300",   icon: "🟣" },
  "受洗成员":   { dot: "bg-emerald-500", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: "🟢" },
  "团契成员":   { dot: "bg-fuchsia-500", cls: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300", icon: "🟣" },
  "事工同工":   { dot: "bg-amber-500",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",      icon: "⭐" },
  "事工负责人": { dot: "bg-rose-500",    cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300",         icon: "👑" },
};

/* ---------- Note (JSON) Parser ---------- */

function parseNote(raw: string | null): NoteData {
  if (!raw) return { note: "", timeline: [] };
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && Array.isArray(obj.timeline)) {
      return { note: String(obj.note ?? ""), timeline: obj.timeline };
    }
  } catch {}
  return { note: raw, timeline: [] };
}

function serializeNote(d: NoteData): string | null {
  if (!d.note && d.timeline.length === 0) return null;
  if (d.timeline.length === 0) return d.note || null;
  return JSON.stringify({ note: d.note, timeline: d.timeline });
}

/* ---------- Avatar ---------- */

const AVATAR_PALETTE = [
  "bg-rose-500/15 text-rose-700 ring-rose-500/30",
  "bg-amber-500/15 text-amber-700 ring-amber-500/30",
  "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
  "bg-sky-500/15 text-sky-700 ring-sky-500/30",
  "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30",
  "bg-violet-500/15 text-violet-700 ring-violet-500/30",
  "bg-teal-500/15 text-teal-700 ring-teal-500/30",
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(r: Reg): string {
  if (r.name) return r.name.trim().slice(0, 1);
  if (r.name_en) return r.name_en.trim().slice(0, 1).toUpperCase();
  return "?";
}
function Avatar({ r, size = "md" }: { r: Reg; size?: "md" | "lg" }) {
  const sz = size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  return (
    <div className={cn("shrink-0 rounded-full grid place-items-center font-medium ring-1", sz, avatarColor(r.id))}>
      {initials(r)}
    </div>
  );
}

/* ---------- Pills ---------- */

function Pill({ children, cls, dot }: { children: React.ReactNode; cls: string; dot?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", cls)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

function StageTag({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const s = STAGE_STYLE[value] ?? STAGE_STYLE["慕道友"];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="outline-none">
          <Pill cls={cn(s.cls, "hover:opacity-80 cursor-pointer")} dot={s.dot}>{value}</Pill>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {STAGES.map((opt) => {
          const st = STAGE_STYLE[opt];
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-accent flex items-center gap-2",
                value === opt && "bg-accent",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", st.dot)} />
              {opt}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Date helpers ---------- */

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDateOnly(s: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "yyyy-MM-dd");
}

function NextFollowupBadge({ value }: { value: string | null }) {
  if (!value) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> 未设置
      </span>
    );
  }
  const d = parseDateOnly(value);
  if (!d) return <span className="text-xs">{value}</span>;
  const diff = differenceInCalendarDays(d, new Date());
  let cls = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  let icon = <CheckCircle2 className="h-3.5 w-3.5" />;
  if (diff < 0) {
    cls = "bg-rose-500/10 text-rose-700 dark:text-rose-300";
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
  } else if (diff <= 3) {
    cls = "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    icon = <Clock className="h-3.5 w-3.5" />;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium tabular-nums", cls)}>
      {icon}
      {value}
    </span>
  );
}

function LastFollowupBadge({ value }: { value: string | null }) {
  if (!value) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> 未跟进
      </span>
    );
  }
  const days = differenceInCalendarDays(new Date(), new Date(value));
  let cls = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (days > 30) cls = "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  else if (days > 14) cls = "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium tabular-nums", cls)}>
      <CalendarIcon className="h-3.5 w-3.5" />
      {fmtDate(value)}
    </span>
  );
}

/* ---------- Stat card ---------- */

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "orange" | "sky" | "emerald" | "violet" | "amber" | "rose" | "fuchsia";
}) {
  const map: Record<string, string> = {
    default: "text-foreground",
    orange: "text-orange-600",
    sky: "text-sky-600",
    emerald: "text-emerald-600",
    violet: "text-violet-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    fuchsia: "text-fuchsia-600",
  };
  return (
    <div className="flex-1 min-w-[110px] rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums mt-0.5", map[tone])}>{value}</div>
    </div>
  );
}

/* ---------- Main Component ---------- */

export function FaithFollowupCRM({
  regs,
  setRegs,
}: {
  regs: Reg[];
  setRegs: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [detailReg, setDetailReg] = useState<Reg | null>(null);

  // include all seekers + anyone with an advanced stage set
  const list = useMemo(
    () =>
      regs.filter(
        (r) =>
          r.faith === "seeker" ||
          (r.faith_stage && normStage(r.faith_stage) !== "慕道友"),
      ),
    [regs],
  );

  const persons = useMemo(() => {
    const set = new Set<string>();
    list.forEach((r) => r.follow_up_person && set.add(r.follow_up_person));
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((r) => {
      const stage = normStage(r.faith_stage);
      if (stageFilter !== "all" && stage !== stageFilter) return false;
      if (personFilter !== "all" && (r.follow_up_person ?? "") !== personFilter) return false;
      if (!kw) return true;
      return [r.name, r.name_en, r.phone, r.follow_up_person]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(kw));
    });
  }, [list, q, stageFilter, personFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach((s) => (counts[s] = 0));
    list.forEach((r) => {
      const s = normStage(r.faith_stage);
      if (counts[s] !== undefined) counts[s]++;
    });
    const overdue = list.filter(
      (r) => r.next_followup_at && differenceInCalendarDays(parseDateOnly(r.next_followup_at)!, new Date()) < 0,
    ).length;
    return { counts, overdue };
  }, [list]);

  async function updateStage(id: string, value: string) {
    const prev = regs.find((r) => r.id === id)?.faith_stage ?? "慕道友";
    setRegs((l) => l.map((x) => (x.id === id ? { ...x, faith_stage: value } : x)));
    setDetailReg((d) => (d && d.id === id ? { ...d, faith_stage: value } : d));
    const { error } = await supabase
      .from("registrations")
      .update({ faith_stage: value } as never)
      .eq("id", id);
    if (error) {
      setRegs((l) => l.map((x) => (x.id === id ? { ...x, faith_stage: prev } : x)));
      toast.error("保存失败：" + error.message);
    } else toast.success("阶段已更新");
  }

  async function updateField(id: string, patch: Partial<Reg>) {
    const prev = regs.find((r) => r.id === id);
    if (!prev) return;
    setRegs((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setDetailReg((d) => (d && d.id === id ? { ...d, ...patch } : d));
    const { error } = await supabase
      .from("registrations")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      setRegs((l) => l.map((x) => (x.id === id ? prev : x)));
      toast.error("保存失败：" + error.message);
    } else toast.success("已保存");
  }

  return (
    <TooltipProvider delayDuration={300}>
      <section className="bg-card border border-border/50 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-serif text-xl">信仰成长档案</h2>
            <p className="text-xs text-muted-foreground mt-1">
              来源：新人登记 · 慕道友与已进入成长阶段的成员 · 共 {filtered.length} / {list.length} 人
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 mb-4">
          <StatCard label="🟠 慕道友"   value={stats.counts["慕道友"]}   tone="orange" />
          <StatCard label="🔵 初信者"   value={stats.counts["初信者"]}   tone="sky" />
          <StatCard label="🟢 受洗成员" value={stats.counts["受洗成员"]} tone="emerald" />
          <StatCard label="🟣 团契成员" value={stats.counts["团契成员"]} tone="fuchsia" />
          <StatCard label="⭐ 事工同工" value={stats.counts["事工同工"]} tone="amber" />
          <StatCard label="👑 事工负责人" value={stats.counts["事工负责人"]} tone="rose" />
          <StatCard label="⚠️ 超期未跟进" value={stats.overdue} tone="rose" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input
            placeholder="搜索 姓名 / 电话 / 跟进人"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs"
          >
            <option value="all">全部阶段</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs"
          >
            <option value="all">全部跟进人</option>
            {persons.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {(q || stageFilter !== "all" || personFilter !== "all") && (
            <button
              onClick={() => { setQ(""); setStageFilter("all"); setPersonFilter("all"); }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> 清除筛选
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium">姓名</th>
                  <th className="py-2.5 px-3 font-medium">电话</th>
                  <th className="py-2.5 px-3 font-medium">成长阶段</th>
                  <th className="py-2.5 px-3 font-medium">跟进人</th>
                  <th className="py-2.5 px-3 font-medium">最后跟进</th>
                  <th className="py-2.5 px-3 font-medium">下次跟进</th>
                  <th className="py-2.5 px-3 font-medium">备注</th>
                  <th className="py-2.5 px-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      暂无匹配记录
                    </td>
                  </tr>
                ) : filtered.map((r) => {
                  const stage = normStage(r.faith_stage);
                  const note = parseNote(r.faith_growth_note);
                  return (
                    <tr key={r.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors align-middle">
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setDetailReg(r)}
                          className="flex items-center gap-2.5 text-left group"
                        >
                          <Avatar r={r} />
                          <div className="leading-tight">
                            <div className="font-medium text-foreground group-hover:underline">
                              {r.name || "—"}
                            </div>
                            {r.name_en && (
                              <div className="text-[11px] text-muted-foreground">{r.name_en}</div>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-xs">
                        {r.phone || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <StageTag value={stage} onChange={(v) => updateStage(r.id, v)} />
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <FollowUpPersonEditor reg={r} onSave={(v) => updateField(r.id, { follow_up_person: v })} />
                      </td>
                      <td className="py-3 px-3">
                        <DatePickerCell
                          value={r.last_followup_at ? toDateOnly(new Date(r.last_followup_at)) : null}
                          onChange={(v) =>
                            updateField(r.id, {
                              last_followup_at: v ? new Date(`${v}T00:00:00`).toISOString() : null,
                            })
                          }
                          render={() => <LastFollowupBadge value={r.last_followup_at} />}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <DatePickerCell
                          value={r.next_followup_at}
                          onChange={(v) => updateField(r.id, { next_followup_at: v })}
                          render={() => <NextFollowupBadge value={r.next_followup_at} />}
                        />
                      </td>
                      <td className="py-3 px-3 max-w-[260px]">
                        {note.note ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-foreground/90 line-clamp-1 cursor-default">{note.note}</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs whitespace-pre-wrap text-xs">
                              {note.note}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {note.timeline.length > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {note.timeline.length} 条跟进记录
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailReg(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>查看成长档案</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <DetailDrawer
        reg={detailReg}
        onClose={() => setDetailReg(null)}
        onStageChange={(v) => detailReg && updateStage(detailReg.id, v)}
        onSaveNote={async (data) => {
          if (!detailReg) return;
          await updateField(detailReg.id, { faith_growth_note: serializeNote(data) });
        }}
      />
    </TooltipProvider>
  );
}

/* ---------- Sub-components ---------- */

function FollowUpPersonEditor({
  reg,
  onSave,
}: {
  reg: Reg;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reg.follow_up_person ?? "");
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-7 text-xs w-28"
          autoFocus
        />
        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { onSave(draft.trim() || null); setEditing(false); }}>
          保存
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditing(false); setDraft(reg.follow_up_person ?? ""); }}>
          ×
        </Button>
      </div>
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 hover:text-foreground text-xs">
      <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
      {reg.follow_up_person || <span className="text-muted-foreground">未指派</span>}
      <Pencil className="h-3 w-3 text-muted-foreground/60" />
    </button>
  );
}

function DatePickerCell({
  value,
  onChange,
  render,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  render: () => React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="outline-none hover:opacity-80">{render()}</button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parseDateOnly(value)}
          onSelect={(d) => onChange(d ? toDateOnly(d) : null)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
        {value && (
          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(null)}>清除</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Detail Drawer ---------- */

function DetailDrawer({
  reg,
  onClose,
  onStageChange,
  onSaveNote,
}: {
  reg: Reg | null;
  onClose: () => void;
  onStageChange: (v: string) => void;
  onSaveNote: (data: NoteData) => Promise<void> | void;
}) {
  const note = useMemo(() => parseNote(reg?.faith_growth_note ?? null), [reg?.faith_growth_note]);
  const [noteDraft, setNoteDraft] = useState(note.note);
  const [newDate, setNewDate] = useState<string>(toDateOnly(new Date()));
  const [newType, setNewType] = useState("电话联系");
  const [newContent, setNewContent] = useState("");

  // reset drafts when reg changes
  useMemoReset(reg?.id, () => {
    setNoteDraft(note.note);
    setNewDate(toDateOnly(new Date()));
    setNewType("电话联系");
    setNewContent("");
  });

  if (!reg) return null;
  const stage = normStage(reg.faith_stage);
  const st = STAGE_STYLE[stage];

  // Build full timeline: registration + saved entries (sorted desc)
  const timeline: TimelineEntry[] = [
    ...(reg.created_at ? [{ date: toDateOnly(new Date(reg.created_at)), type: "新人登记", content: "" }] : []),
    ...note.timeline,
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  async function addEntry() {
    if (!newDate || !newType.trim()) {
      toast.error("请填写日期和类型");
      return;
    }
    const next: NoteData = {
      note: noteDraft,
      timeline: [...note.timeline, { date: newDate, type: newType.trim(), content: newContent.trim() || undefined }],
    };
    await onSaveNote(next);
    setNewContent("");
    toast.success("已添加跟进记录");
  }

  async function deleteEntry(idx: number) {
    const next: NoteData = {
      note: noteDraft,
      timeline: note.timeline.filter((_, i) => i !== idx),
    };
    await onSaveNote(next);
  }

  async function saveNoteOnly() {
    await onSaveNote({ note: noteDraft, timeline: note.timeline });
  }

  return (
    <Sheet open={!!reg} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar r={reg} size="lg" />
            <div>
              <SheetTitle className="text-lg">{reg.name || "—"}</SheetTitle>
              <SheetDescription>{reg.name_en || ""}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Stage */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">当前阶段：</span>
          <StageTag value={stage} onChange={onStageChange} />
        </div>

        {/* Contact info */}
        <div className="mt-4 rounded-xl border border-border/60 p-3 space-y-2 text-sm">
          <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="电话" value={reg.phone} />
          <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="邮箱" value={reg.email ?? null} />
          <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="地址" value={[reg.address, reg.city].filter(Boolean).join(" · ") || null} />
          <InfoRow icon={<UserCircle2 className="h-3.5 w-3.5" />} label="性别 / 年龄" value={[reg.gender, reg.age_group].filter(Boolean).join(" · ") || null} />
          <InfoRow icon={<UserCircle2 className="h-3.5 w-3.5" />} label="婚姻" value={reg.marital_status ?? null} />
          <InfoRow icon={<ChevronRight className="h-3.5 w-3.5" />} label="信仰" value={reg.faith ?? null} />
          <InfoRow icon={<ChevronRight className="h-3.5 w-3.5" />} label="来源" value={reg.source_channel || reg.source || null} />
          <InfoRow icon={<ChevronRight className="h-3.5 w-3.5" />} label="介绍人" value={reg.invited_by ?? null} />
          <InfoRow icon={<ChevronRight className="h-3.5 w-3.5" />} label="跟进人" value={reg.follow_up_person ?? null} />
        </div>

        {/* Add follow-up */}
        <div className="mt-5">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> 新增跟进记录
          </h3>
          <div className="rounded-xl border border-border/60 p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-8 text-xs flex-1"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-8 px-2 rounded-md border border-border bg-background text-xs"
              >
                {["电话联系", "信息联系", "邀请聚会", "参加主日", "参加团契", "参加查经", "受洗课程", "决志", "受洗", "其他"].map((t) =>
                  <option key={t} value={t}>{t}</option>,
                )}
              </select>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="备注（可选）"
              rows={2}
              className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
            />
            <div className="flex justify-end">
              <Button size="sm" className="h-7 text-xs" onClick={addEntry}>添加</Button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-5">
          <h3 className="text-sm font-medium mb-2">成长时间轴</h3>
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无记录</p>
          ) : (
            <ol className="relative border-l-2 border-border/60 pl-4 space-y-3">
              {timeline.map((e, i) => {
                const isReg = e.type === "新人登记";
                // index in note.timeline for delete (skip the synthetic registration entry)
                const noteIdx = note.timeline.findIndex(
                  (n) => n.date === e.date && n.type === e.type && (n.content ?? "") === (e.content ?? ""),
                );
                return (
                  <li key={i} className="relative">
                    <span className={cn("absolute -left-[22px] top-1 h-3 w-3 rounded-full ring-2 ring-card", isReg ? "bg-primary" : "bg-emerald-500")} />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground tabular-nums">{e.date}</div>
                        <div className="text-sm font-medium">{e.type}</div>
                        {e.content && <div className="text-xs text-foreground/80 mt-0.5 whitespace-pre-wrap">{e.content}</div>}
                      </div>
                      {!isReg && noteIdx >= 0 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteEntry(noteIdx)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Note */}
        <div className="mt-5 mb-6">
          <h3 className="text-sm font-medium mb-2">备注 / 牧养笔记</h3>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={4}
            className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
            placeholder="记录牧养重点、家庭情况、属灵状态等"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" className="h-7 text-xs" onClick={saveNoteOnly}>保存备注</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground inline-flex items-center gap-1 w-20 shrink-0">{icon} {label}</span>
      <span className="text-foreground flex-1 break-words">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

/* Helper: reset state when a key changes */
import { useEffect as _useEffect } from "react";
function useMemoReset(key: string | undefined, fn: () => void) {
  _useEffect(() => { fn(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
}

export default FaithFollowupCRM;