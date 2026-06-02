import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  phone: string | null;
  faith: string | null;
  follow_up_person: string | null;
  faith_growth_note: string | null;
  faith_stage: string | null;
  last_followup_at: string | null;
  next_followup_at: string | null;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateOnly(s: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

const STAGE_OPTIONS = ["慕道友", "已跟进", "受洗班", "决志", "已受洗"] as const;
const STAGE_TONE: Record<string, string> = {
  "慕道友": "border-border text-muted-foreground",
  "已跟进": "border-sky-500/40 text-sky-600",
  "受洗班": "border-amber-500/40 text-amber-600",
  "决志": "border-violet-500/40 text-violet-600",
  "已受洗": "border-emerald-500/40 text-emerald-600",
};

export function FaithFollowupSection({
  regs,
  setRegs,
}: {
  regs: Reg[];
  setRegs: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  const [q, setQ] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const seekers = useMemo(
    () =>
      regs.filter(
        (r) =>
          r.faith === "seeker" ||
          (r.faith_stage && r.faith_stage !== "慕道友"),
      ),
    [regs],
  );
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return seekers;
    return seekers.filter((r) =>
      [r.name, r.name_en, r.phone, r.follow_up_person]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(kw)),
    );
  }, [seekers, q]);

  async function updateStage(id: string, value: string) {
    const prev = regs.find((r) => r.id === id)?.faith_stage ?? "慕道友";
    setRegs((list) => list.map((x) => (x.id === id ? { ...x, faith_stage: value } : x)));
    const { error } = await supabase
      .from("registrations")
      .update({ faith_stage: value } as never)
      .eq("id", id);
    if (error) {
      setRegs((list) => list.map((x) => (x.id === id ? { ...x, faith_stage: prev } : x)));
      toast.error("保存失败：" + error.message);
    } else {
      toast.success("当前阶段已更新");
    }
  }

  async function saveNote(id: string) {
    setSavingId(id);
    const value = noteDraft.trim() || null;
    const { error } = await supabase
      .from("registrations")
      .update({ faith_growth_note: value } as never)
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("保存失败：" + error.message);
      return;
    }
    setRegs((list) => list.map((x) => (x.id === id ? { ...x, faith_growth_note: value } : x)));
    setEditingNoteId(null);
    toast.success("备注已保存");
  }

  async function savePerson(id: string) {
    setSavingId(id);
    const value = personDraft.trim() || null;
    const { error } = await supabase
      .from("registrations")
      .update({ follow_up_person: value } as never)
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("保存失败：" + error.message);
      return;
    }
    setRegs((list) => list.map((x) => (x.id === id ? { ...x, follow_up_person: value } : x)));
    setEditingPersonId(null);
    toast.success("跟进人已保存");
  }

  async function updateLastFollowup(id: string, value: string | null) {
    const prev = regs.find((r) => r.id === id)?.last_followup_at ?? null;
    const iso = value ? new Date(`${value}T00:00:00`).toISOString() : null;
    setRegs((list) => list.map((x) => (x.id === id ? { ...x, last_followup_at: iso } : x)));
    const { error } = await supabase
      .from("registrations")
      .update({ last_followup_at: iso } as never)
      .eq("id", id);
    if (error) {
      setRegs((list) => list.map((x) => (x.id === id ? { ...x, last_followup_at: prev } : x)));
      toast.error("保存失败：" + error.message);
    } else {
      toast.success("最后跟进日期已保存");
    }
  }

  async function updateNextFollowup(id: string, value: string | null) {
    const prev = regs.find((r) => r.id === id)?.next_followup_at ?? null;
    setRegs((list) => list.map((x) => (x.id === id ? { ...x, next_followup_at: value } : x)));
    const { error } = await supabase
      .from("registrations")
      .update({ next_followup_at: value } as never)
      .eq("id", id);
    if (error) {
      setRegs((list) => list.map((x) => (x.id === id ? { ...x, next_followup_at: prev } : x)));
      toast.error("保存失败：" + error.message);
    } else {
      toast.success("下次跟进日期已保存");
    }
  }

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-xl">信仰成长档案</h2>
          <p className="text-xs text-muted-foreground mt-1">
            来源：新人登记名单 · 默认显示信仰属性为「慕道友」的人，并保留已进入其他阶段的成员 · 共 {seekers.length} 人
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 姓名 / 电话 / 跟进人"
          className="h-9 px-3 rounded-md border border-border bg-background text-sm w-full sm:w-72"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">暂无慕道友记录</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/60 text-muted-foreground">
                <th className="py-2 px-2">中文名</th>
                <th className="py-2 px-2">英文名</th>
                <th className="py-2 px-2">电话</th>
                <th className="py-2 px-2">当前阶段</th>
                <th className="py-2 px-2">跟进人</th>
                <th className="py-2 px-2">最后跟进日期</th>
                <th className="py-2 px-2">下次跟进日期</th>
                <th className="py-2 px-2">备注</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isEditing = editingNoteId === r.id;
                const isEditingPerson = editingPersonId === r.id;
                const stage = r.faith_stage || "慕道友";
                return (
                  <tr key={r.id} className="border-b border-border/40 align-top">
                    <td className="py-2 px-2 font-medium text-foreground">{r.name || "—"}</td>
                    <td className="py-2 px-2">{r.name_en || "—"}</td>
                    <td className="py-2 px-2 tabular-nums">{r.phone || "—"}</td>
                    <td className="py-2 px-2">
                      <select
                        value={stage}
                        onChange={(e) => updateStage(r.id, e.target.value)}
                        className={
                          "h-8 px-2 rounded-md border text-xs bg-background " +
                          (STAGE_TONE[stage] ?? "border-border text-muted-foreground")
                        }
                      >
                        {STAGE_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2 min-w-[160px]">
                      {isEditingPerson ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={personDraft}
                            onChange={(e) => setPersonDraft(e.target.value)}
                            className="flex-1 h-8 px-2 rounded-md border border-border bg-background text-xs"
                          />
                          <button
                            type="button"
                            disabled={savingId === r.id}
                            onClick={() => savePerson(r.id)}
                            className="px-2 h-8 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPersonId(null)}
                            className="px-2 h-8 rounded-md border border-border text-xs"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="flex-1">
                            {r.follow_up_person || <span className="text-muted-foreground">—</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPersonId(r.id);
                              setPersonDraft(r.follow_up_person ?? "");
                            }}
                            className="px-2 py-1 rounded-md border border-border text-xs hover:bg-accent"
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 tabular-nums">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={
                              "inline-flex items-center gap-1 h-8 px-2 rounded-md border border-border bg-background text-xs hover:bg-accent " +
                              (r.last_followup_at ? "text-foreground" : "text-muted-foreground")
                            }
                          >
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {r.last_followup_at ? fmtDate(r.last_followup_at) : "未设置"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={r.last_followup_at ? new Date(r.last_followup_at) : undefined}
                            onSelect={(d) => updateLastFollowup(r.id, d ? toDateOnly(d) : null)}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                          {r.last_followup_at && (
                            <div className="p-2 border-t border-border">
                              <button
                                type="button"
                                onClick={() => updateLastFollowup(r.id, null)}
                                className="w-full px-2 py-1 rounded-md border border-border text-xs hover:bg-accent"
                              >
                                清除
                              </button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="py-2 px-2 tabular-nums">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={
                              "inline-flex items-center gap-1 h-8 px-2 rounded-md border border-border bg-background text-xs hover:bg-accent " +
                              (r.next_followup_at ? "text-foreground" : "text-muted-foreground")
                            }
                          >
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {r.next_followup_at ? r.next_followup_at : "未设置"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseDateOnly(r.next_followup_at)}
                            onSelect={(d) => updateNextFollowup(r.id, d ? toDateOnly(d) : null)}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                          {r.next_followup_at && (
                            <div className="p-2 border-t border-border">
                              <button
                                type="button"
                                onClick={() => updateNextFollowup(r.id, null)}
                                className="w-full px-2 py-1 rounded-md border border-border text-xs hover:bg-accent"
                              >
                                清除
                              </button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="py-2 px-2 max-w-[320px]">
                      {isEditing ? (
                        <div className="flex items-start gap-2">
                          <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            rows={2}
                            className="flex-1 min-w-[180px] px-2 py-1 rounded-md border border-border bg-background text-xs"
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={savingId === r.id}
                              onClick={() => saveNote(r.id)}
                              className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-1 rounded-md border border-border text-xs"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <span
                            className="flex-1 whitespace-pre-wrap break-words text-foreground/90"
                            title={r.faith_growth_note ?? ""}
                          >
                            {r.faith_growth_note || <span className="text-muted-foreground">—</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(r.id);
                              setNoteDraft(r.faith_growth_note ?? "");
                            }}
                            className="px-2 py-1 rounded-md border border-border text-xs hover:bg-accent"
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default FaithFollowupSection;