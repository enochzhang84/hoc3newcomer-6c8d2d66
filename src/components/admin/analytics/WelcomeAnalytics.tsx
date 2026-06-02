import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, StatGrid, groupBy } from "./AnalyticsPrimitives";

type Entry = { service_date: string | null; worker: string | null; panel_key: string };

export function WelcomeAnalytics() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("hospitality_ministry_entries")
        .select("service_date,worker,panel_key").order("service_date", { ascending: false }).limit(400);
      setItems((data ?? []) as Entry[]);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;
  const byPanel = groupBy(items, (x) => x.panel_key || "其他");
  const byWorker = groupBy(items.filter((x) => x.worker?.trim()), (x) => x.worker!.trim());
  return (
    <div className="space-y-3">
      <StatGrid cols={2}>
        <StatCard compact icon="🤝" label="服侍记录" value={items.length} />
        <StatCard compact icon="👥" label="参与同工" value={byWorker.length} />
      </StatGrid>
      <Section title="按项目分布"><MiniBars items={byPanel} /></Section>
      <Section title="同工服侍 Top"><MiniBars items={byWorker} /></Section>
    </div>
  );
}