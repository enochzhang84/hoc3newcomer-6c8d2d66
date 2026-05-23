import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  gender: string | null;
  age_group: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  faith: string | null;
  faith_years: number | null;
  faith_other: string | null;
  marital_status: string | null;
  spouse_name: string | null;
  referrer_type: string | null;
  invited_by: string | null;
  referrer_other: string | null;
  wants_visit: boolean | null;
  wants_info: boolean | null;
  notes: string | null;
  follow_up_person: string | null;
  created_at: string;
};

const TZ = "America/Los_Angeles";

function formatReferrer(r: Reg): string {
  switch (r.referrer_type) {
    case "self": return "自己";
    case "friend": return `亲友:${r.invited_by ?? ""}`;
    case "wechat": return "微信/小红书";
    case "youtube": return "YouTube";
    case "missionary": return `宣教士:${r.invited_by ?? ""}`;
    case "other": return `其他:${r.referrer_other ?? ""}`;
    default: return "—";
  }
}

function formatFaith(r: Reg): string {
  if (r.faith === "christian") return `基督徒${r.faith_years ? ` ${r.faith_years}年` : ""}`;
  if (r.faith === "seeker") return "慕道友";
  if (r.faith === "other") return `其他${r.faith_other ? `:${r.faith_other}` : ""}`;
  return "—";
}

export const Route = createFileRoute("/data-preview")({
  component: DataPreviewPage,
});

function DataPreviewPage() {
  const navigate = useNavigate();
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"all" | "month" | "week">("all");

  useEffect(() => {
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          navigate({ to: "/login" });
          return;
        }
        const { data, error } = await supabase
          .from("registrations")
          .select(
            "id,name,name_en,gender,age_group,phone,email,city,faith,faith_years,faith_other,marital_status,spouse_name,referrer_type,invited_by,referrer_other,wants_visit,wants_info,notes,follow_up_person,created_at"
          )
          .order("created_at", { ascending: false });
        if (error) console.error("[data-preview] error", error);
        setRegs((data ?? []) as Reg[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const filtered = useMemo(() => {
    if (range === "all") return regs;
    const now = Date.now();
    const ms = range === "week" ? 7 * 86400000 : 30 * 86400000;
    return regs.filter((r) => now - new Date(r.created_at).getTime() <= ms);
  }, [regs, range]);

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: TZ, year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <header className="text-center mb-6 pb-4 border-b border-border/60">
          <h1 className="font-serif text-3xl mb-1">基督之家第三家 — 新人登记数据</h1>
          <p className="text-muted-foreground text-sm">
            生成日期:{today} · 共 {filtered.length} 人
          </p>
        </header>

        <div className="flex flex-wrap justify-between items-center gap-2 mb-4 print:hidden">
          <div className="flex gap-2">
            {([
              { v: "all", l: "全部" },
              { v: "month", l: "近一月" },
              { v: "week", l: "近一周" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => setRange(o.v)}
                className={`text-sm px-3 py-1.5 rounded-md border ${range === o.v ? "bg-foreground text-background border-foreground" : "border-border/60 hover:bg-muted/40"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="text-sm px-4 py-2 rounded-md border border-border/60 hover:bg-muted/40"
            >
              打印
            </button>
            <button
              onClick={() => window.close()}
              className="text-sm px-4 py-2 rounded-md border border-border/60 hover:bg-muted/40"
            >
              关闭
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">加载中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">暂无数据</p>
        ) : (
          <div className="overflow-x-auto bg-card border border-border/50 rounded-2xl print:border-0 print:rounded-none">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground bg-muted/30">
                  <th className="py-2 px-2">日期</th>
                  <th className="py-2 px-2">姓名</th>
                  <th className="py-2 px-2">英文</th>
                  <th className="py-2 px-2">性别</th>
                  <th className="py-2 px-2">年龄</th>
                  <th className="py-2 px-2">电话</th>
                  <th className="py-2 px-2">城市</th>
                  <th className="py-2 px-2">信仰</th>
                  <th className="py-2 px-2">如何知道我们</th>
                  <th className="py-2 px-2">意向</th>
                  <th className="py-2 px-2">跟进人</th>
                  <th className="py-2 px-2">备注</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 align-top">
                    <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("zh-CN", {
                        timeZone: TZ, month: "2-digit", day: "2-digit",
                      })}
                    </td>
                    <td className="py-2 px-2 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="py-2 px-2">{r.name_en ?? "—"}</td>
                    <td className="py-2 px-2">{r.gender ?? "—"}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{r.age_group ?? "—"}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{r.phone ?? "—"}</td>
                    <td className="py-2 px-2">{r.city ?? "—"}</td>
                    <td className="py-2 px-2">{formatFaith(r)}</td>
                    <td className="py-2 px-2">{formatReferrer(r)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {[r.wants_visit ? "探访" : null, r.wants_info ? "资料" : null].filter(Boolean).join("/") || "—"}
                    </td>
                    <td className="py-2 px-2">{r.follow_up_person ?? "—"}</td>
                    <td className="py-2 px-2">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}