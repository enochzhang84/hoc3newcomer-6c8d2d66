import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTodayPublic } from "@/lib/today-public.functions";

const SF_TZ = "America/Los_Angeles";

type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  faith: string | null;
  faith_years: number | null;
  faith_other: string | null;
  referrer_type: string | null;
  invited_by: string | null;
  referrer_other: string | null;
  notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/today-public/$token")({
  head: () => ({
    meta: [
      { title: "今日新人 — 基督三家" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TodayPublicPage,
});

function TodayPublicPage() {
  const { token } = Route.useParams();
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      setErr(null);
      const res = await getTodayPublic({ data: { token } });
      setRegs(res.regs as Reg[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: SF_TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">无法访问：{err}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10 max-w-5xl">
        <header className="text-center mb-8 pb-6 border-b border-border/60">
          <h1 className="font-serif text-4xl mb-2">基督三家欢迎你</h1>
          <p className="text-muted-foreground">
            {today} · 今日新登记 {regs.length} 人
          </p>
        </header>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">加载中...</p>
        ) : regs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">今天暂无新登记</p>
        ) : (
          <div className="overflow-x-auto bg-card border border-border/50 rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground bg-muted/30">
                  <th className="py-3 px-3">登记时间</th>
                  <th className="py-3 px-3">姓名(中)</th>
                  <th className="py-3 px-3">姓名(英)</th>
                  <th className="py-3 px-3">信仰</th>
                  <th className="py-3 px-3">来到方式</th>
                  <th className="py-3 px-3">备注</th>
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("zh-CN", {
                        timeZone: SF_TZ,
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 font-medium">{r.name}</td>
                    <td className="py-3 px-3">{r.name_en ?? "—"}</td>
                    <td className="py-3 px-3">
                      {r.faith === "christian"
                        ? `基督徒${r.faith_years ? ` ${r.faith_years}年` : ""}`
                        : r.faith === "seeker"
                          ? "慕道友"
                          : r.faith === "other"
                            ? `其他${r.faith_other ? `:${r.faith_other}` : ""}`
                            : "—"}
                    </td>
                    <td className="py-3 px-3">
                      {r.referrer_type === "self"
                        ? "自己"
                        : r.referrer_type === "friend"
                          ? `亲友:${r.invited_by ?? ""}`
                          : r.referrer_type === "other"
                            ? `其他:${r.referrer_other ?? ""}`
                            : "—"}
                    </td>
                    <td className="py-3 px-3">{r.notes ?? "—"}</td>
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
