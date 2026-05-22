import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const SAN_FRANCISCO_TIME_ZONE = "America/Los_Angeles";

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function getOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return zonedAsUtc - date.getTime();
}

function zonedMidnightToUtc(year: number, month: number, day: number, timeZone: string) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcGuess.getTime() - getOffsetMs(utcGuess, timeZone));
}

function getTodayRangeForSanFrancisco() {
  const { year, month, day } = getTimeZoneParts(new Date(), SAN_FRANCISCO_TIME_ZONE);
  return {
    start: zonedMidnightToUtc(year, month, day, SAN_FRANCISCO_TIME_ZONE).toISOString(),
    end: zonedMidnightToUtc(year, month, day + 1, SAN_FRANCISCO_TIME_ZONE).toISOString(),
  };
}

export const Route = createFileRoute("/today-preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const navigate = useNavigate();
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/login" });
        return;
      }
      const { start, end } = getTodayRangeForSanFrancisco();
      const { data } = await supabase
        .from("registrations")
        .select(
          "id,name,name_en,faith,faith_years,faith_other,referrer_type,invited_by,referrer_other,notes,created_at",
        )
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });
      setRegs((data ?? []) as Reg[]);
      setLoading(false);
    })();
  }, [navigate]);

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: SAN_FRANCISCO_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10 max-w-5xl">
        <header className="text-center mb-8 pb-6 border-b border-border/60">
          <h1 className="font-serif text-4xl mb-2">基督三家欢迎你</h1>
          <p className="text-muted-foreground">
            {today} · 今日新登记 {regs.length} 人
          </p>
        </header>

        <div className="flex justify-end gap-2 mb-4 print:hidden">
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

        {loading ? (
          <p className="text-center text-muted-foreground py-12">加载中...</p>
        ) : regs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">今天暂无新登记</p>
        ) : (
          <div className="overflow-x-auto bg-card border border-border/50 rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground bg-muted/30">
                  <th className="py-3 px-3">登记日期</th>
                  <th className="py-3 px-3">姓名(中)</th>
                  <th className="py-3 px-3">姓名(英)</th>
                  <th className="py-3 px-3">信仰</th>
                  <th className="py-3 px-3">介绍人</th>
                  <th className="py-3 px-3">备注</th>
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("zh-CN", {
                        timeZone: SAN_FRANCISCO_TIME_ZONE,
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