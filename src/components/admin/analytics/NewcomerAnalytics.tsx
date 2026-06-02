import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, groupBy } from "./AnalyticsPrimitives";

type Reg = {
  created_at: string; city: string | null; age_group: string | null;
  faith: string | null; follow_up_person: string | null; referrer_type: string | null; invited_by: string | null;
};

export function NewcomerAnalytics() {
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("registrations")
        .select("created_at,city,age_group,faith,follow_up_person,referrer_type,invited_by")
        .order("created_at", { ascending: false }).limit(500);
      setRegs((data ?? []) as Reg[]);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = regs.filter((r) => new Date(r.created_at) >= monthStart).length;
  const followed = regs.filter((r) => r.follow_up_person?.trim()).length;
  const byCity = groupBy(regs, (r) => r.city || "未填");
  const byAge = groupBy(regs, (r) => r.age_group || "未填");
  const byFaith = groupBy(regs, (r) =>
    r.faith === "christian" ? "基督徒" : r.faith === "seeker" ? "慕道友" : r.faith === "other" ? "其他" : "未填");
  const byInviter = groupBy(regs.filter((r) => r.referrer_type === "friend" && r.invited_by?.trim()), (r) => r.invited_by!.trim());

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="累计登记" value={regs.length} />
        <StatCard label="本月新增" value={thisMonth} />
        <StatCard label="已跟进" value={followed} />
        <StatCard label="未跟进" value={regs.length - followed} />
      </div>
      <Section title="信仰背景"><MiniBars items={byFaith} /></Section>
      <Section title="年龄分布"><MiniBars items={byAge} /></Section>
      <Section title="城市 Top"><MiniBars items={byCity} /></Section>
      <Section title="邀请人 Top"><MiniBars items={byInviter} /></Section>
    </div>
  );
}