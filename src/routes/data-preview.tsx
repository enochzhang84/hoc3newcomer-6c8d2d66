import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/data-preview")({
  component: DataPreviewPage,
});

function DataPreviewPage() {
  const navigate = useNavigate();
  const [regs, setRegs] = useState<Reg[]>([]);
  const [eventsCount, setEventsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          navigate({ to: "/login" });
          return;
        }
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", session.session.user.id);
        const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
        if (!isAdmin) {
          navigate({ to: "/" });
          return;
        }
        const [regsRes, evRes] = await Promise.all([
          supabase
            .from("registrations")
            .select(
              "id,name,name_en,gender,age_group,phone,email,city,faith,faith_years,faith_other,marital_status,spouse_name,referrer_type,invited_by,referrer_other,wants_visit,wants_info,notes,follow_up_person,created_at"
            )
            .order("created_at", { ascending: false }),
          supabase.from("events").select("id", { count: "exact", head: true }),
        ]);
        if (regsRes.error) console.error("[data-preview] regs error", regsRes.error);
        setRegs((regsRes.data ?? []) as Reg[]);
        setEventsCount(evRes.count ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: TZ, year: "numeric", month: "long", day: "numeric",
  });

  const thisWeek = countSince(regs, startOfWeek());
  const lastWeek = countBetween(regs, prevStartOfWeek(), startOfWeek());
  const thisMonth = countSince(regs, startOfMonth());
  const lastMonth = countBetween(regs, prevStartOfMonth(), startOfMonth());
  const weekRegs = regs.filter((r) => new Date(r.created_at) >= startOfWeek());
  const monthRegs = regs.filter((r) => new Date(r.created_at) >= startOfMonth());

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-6xl print:px-2 print:py-2 print:max-w-none">
        <header className="text-center mb-6 pb-4 border-b border-border/60">
          <h1 className="font-serif text-3xl mb-1">基督之家第三家 — 数据统计</h1>
          <p className="text-muted-foreground text-sm">
            生成日期:{today} · 共 {regs.length} 人登记
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
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
              <Stat label="总登记数" value={regs.length} />
              <Stat label="希望探访" value={regs.filter((r) => r.wants_visit).length} />
              <Stat label="需要资料" value={regs.filter((r) => r.wants_info).length} />
              <Stat label="活动数" value={eventsCount} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 print:grid-cols-3 print:gap-2">
              <StatBreakdown
                label="本周登记"
                total={thisWeek + lastWeek}
                items={[{ key: "本周", count: thisWeek }, { key: "上周", count: lastWeek }]}
                trend={thisWeek - lastWeek}
                chart
                genderSubset={weekRegs}
              />
              <StatBreakdown
                label="本月登记"
                total={thisMonth + lastMonth}
                items={[{ key: "本月", count: thisMonth }, { key: "上月", count: lastMonth }]}
                trend={thisMonth - lastMonth}
                chart
                genderSubset={monthRegs}
              />
              <StatBreakdown
                label="性别"
                total={regs.length}
                items={groupCounts(regs, (r) =>
                  r.gender === "男" || r.gender === "male" ? "男" :
                  r.gender === "女" || r.gender === "female" ? "女" : "未填"
                )}
                chart
                genderSubset={regs}
              />
              <StatBreakdown
                label="年龄"
                total={regs.length}
                items={groupCounts(regs, (r) => r.age_group ?? "未填")}
                chart
                genderSubset={regs}
              />
              <StatBreakdown
                label="信仰"
                total={regs.length}
                items={groupCounts(regs, (r) =>
                  r.faith === "christian" ? "基督徒" :
                  r.faith === "seeker" ? "慕道友" :
                  r.faith === "other" ? "其他" : "未填"
                )}
                chart
                genderSubset={regs}
              />
              <StatBreakdown
                label="邀请人"
                total={regs.filter((r) => r.referrer_type === "friend" && r.invited_by?.trim()).length}
                items={groupCounts(
                  regs.filter((r) => r.referrer_type === "friend" && r.invited_by?.trim()),
                  (r) => r.invited_by!.trim()
                )}
                rank
              />
              <StatBreakdown
                label="跟进状态"
                total={regs.length}
                items={[
                  { key: "已跟进", count: regs.filter((r) => r.follow_up_person?.trim()).length },
                  { key: "未跟进", count: regs.filter((r) => !r.follow_up_person?.trim()).length },
                ]}
                chart
              />
              <StatBreakdown
                label="跟进人排行"
                total={regs.filter((r) => r.follow_up_person?.trim()).length}
                items={groupCounts(
                  regs.filter((r) => r.follow_up_person?.trim()),
                  (r) => r.follow_up_person!.trim()
                )}
                rank
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 print:p-3 print:rounded-lg flex flex-col justify-center">
      <div className="text-3xl font-serif text-foreground print:text-2xl">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function StatBreakdown({
  label, total, items, trend, chart, rank, genderSubset,
}: {
  label: string;
  total: number;
  items?: { key: string; count: number }[];
  trend?: number;
  chart?: boolean;
  rank?: boolean;
  genderSubset?: Reg[];
}) {
  const max = items && items.length > 0 ? Math.max(...items.map((i) => i.count), 1) : 1;
  const medals = ["🥇", "🥈", "🥉"];
  const male = genderSubset ? genderSubset.filter((r) => r.gender === "男" || r.gender === "male").length : 0;
  const female = genderSubset ? genderSubset.filter((r) => r.gender === "女" || r.gender === "female").length : 0;
  const gTotal = male + female;
  const malePct = gTotal > 0 ? Math.round((male / gTotal) * 100) : 0;
  const femalePct = gTotal > 0 ? 100 - malePct : 0;
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 print:p-3 print:rounded-lg flex flex-col break-inside-avoid">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="text-2xl font-serif text-foreground">{total}</div>
        {typeof trend === "number" && (
          <span className={`text-xs tabular-nums ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"}`}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {trend > 0 ? "+" : ""}{trend}
          </span>
        )}
      </div>
      {items && items.length > 0 && (
        <div className="mt-3">
          {rank ? (
            <div className="space-y-1">
              {items.slice(0, 5).map((it, idx) => (
                <div key={it.key} className="flex items-center gap-2 text-sm">
                  <span className="text-base">{medals[idx] || `${idx + 1}.`}</span>
                  <span className="truncate text-foreground">{it.key}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{it.count}人</span>
                </div>
              ))}
            </div>
          ) : chart ? (
            <div className="space-y-1.5">
              {items.map((it) => (
                <div key={it.key} className="text-xs">
                  <div className="flex justify-between text-muted-foreground mb-0.5">
                    <span className="truncate pr-2">{it.key}</span>
                    <span className="text-foreground tabular-nums">
                      {it.count}
                      {total > 0 && (
                        <span className="text-muted-foreground ml-1">({Math.round((it.count / total) * 100)}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(it.count / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {genderSubset && (
        <div className="mt-3 pt-3 border-t border-border/40 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">男 / 女</span>
            <span className="text-foreground tabular-nums">{male} / {female}</span>
          </div>
          {gTotal > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
              <div className="bg-sky-500" style={{ width: `${malePct}%` }} />
              <div className="bg-pink-500" style={{ width: `${femalePct}%` }} />
            </div>
          )}
          <div className="flex justify-between text-muted-foreground tabular-nums">
            <span>{malePct}%</span>
            <span>{femalePct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function startOfWeek() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff, 0, 0, 0, 0);
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function prevStartOfWeek() {
  const s = startOfWeek();
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7, 0, 0, 0, 0);
}
function prevStartOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
}
function countSince(list: Reg[], since: Date) {
  return list.filter((r) => new Date(r.created_at) >= since).length;
}
function countBetween(list: Reg[], from: Date, to: Date) {
  return list.filter((r) => {
    const t = new Date(r.created_at);
    return t >= from && t < to;
  }).length;
}
function groupCounts(list: Reg[], keyFn: (r: Reg) => string) {
  const map = new Map<string, number>();
  for (const r of list) {
    const k = keyFn(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}