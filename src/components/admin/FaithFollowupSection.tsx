import { useMemo, useState } from "react";

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

export function FaithFollowupSection({ regs }: { regs: Reg[] }) {
  const [q, setQ] = useState("");
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
                const followed = !!r.follow_up_person?.trim();
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
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs " +
                          (followed
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                            : "bg-muted text-muted-foreground border border-border/60")
                        }
                      >
                        {followed ? `已跟进（${r.follow_up_person}）` : "未跟进"}
                      </span>
                    </td>
                    <td className="py-2 px-2 max-w-[280px] truncate" title={r.notes ?? ""}>
                      {r.notes || "—"}
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