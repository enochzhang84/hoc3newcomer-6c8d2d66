import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  referrer_type: string | null;
  invited_by: string | null;
  referrer_other: string | null;
  faith: string | null;
  follow_up_person: string | null;
  notes: string | null;
  created_at: string;
  follow_up_status: string | null;
  faith_growth_note: string | null;
};

function refer(r: Reg): string {
  if (r.referrer_type === "self") return "自己";
  if (r.referrer_type === "friend") return `亲友：${r.invited_by ?? ""}`.trim();
  if (r.referrer_type === "other") return `其他：${r.referrer_other ?? ""}`.trim();
  return "—";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_OPTIONS = ["未跟进", "已跟进"] as const;

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
  const [savingId, setSavingId] = useState<string | null>(null);
  const seekers = useMemo(() => regs.filter((r) => r.faith === "seeker"), [regs]);
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return seekers;
    return seekers.filter((r) =>
      [r.name, r.name_en, r.phone, r.email, r.city, r.invited_by]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(kw)),
    );
  }, [seekers, q]);

  async function updateStatus(id: string, value: string) {
    const prev = regs.find((r) => r.id === id)?.follow_up_status ?? "未跟进";
    setRegs((list) => list.map((x) => (x.id === id ? { ...x, follow_up_status: value } : x)));
    const { error } = await supabase
      .from("registrations")
      .update({ follow_up_status: value } as never)
      .eq("id", id);
    if (error) {
      setRegs((list) => list.map((x) => (x.id === id ? { ...x, follow_up_status: prev } : x)));
      toast.error("保存失败：" + error.message);
    } else {
      toast.success("跟进状态已更新");
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

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-xl">慕道友名单</h2>
          <p className="text-xs text-muted-foreground mt-1">
            来源：新人登记名单 · 筛选条件：信仰属性 = 慕道友 · 共 {seekers.length} 人
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 姓名 / 电话 / 邮箱 / 城市 / 邀请人"
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
                <th className="py-2 px-2">性别</th>
                <th className="py-2 px-2">电话</th>
                <th className="py-2 px-2">邮箱</th>
                <th className="py-2 px-2">城市</th>
                <th className="py-2 px-2">来源 / 邀请人</th>
                <th className="py-2 px-2">登记日期</th>
                <th className="py-2 px-2">跟进状态</th>
                <th className="py-2 px-2">备注</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const status = r.follow_up_status || "未跟进";
                const followed = status === "已跟进";
                const isEditing = editingNoteId === r.id;
                return (
                  <tr key={r.id} className="border-b border-border/40 align-top">
                    <td className="py-2 px-2 font-medium text-foreground">{r.name || "—"}</td>
                    <td className="py-2 px-2">{r.name_en || "—"}</td>
                    <td className="py-2 px-2">{r.gender || "—"}</td>
                    <td className="py-2 px-2 tabular-nums">{r.phone || "—"}</td>
                    <td className="py-2 px-2">{r.email || "—"}</td>
                    <td className="py-2 px-2">{r.city || "—"}</td>
                    <td className="py-2 px-2">{refer(r)}</td>
                    <td className="py-2 px-2 tabular-nums">{fmtDate(r.created_at)}</td>
                    <td className="py-2 px-2">
                      <select
                        value={status}
                        onChange={(e) => updateStatus(r.id, e.target.value)}
                        className={
                          "h-8 px-2 rounded-md border text-xs bg-background " +
                          (followed
                            ? "border-emerald-500/40 text-emerald-600"
                            : "border-border text-muted-foreground")
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
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