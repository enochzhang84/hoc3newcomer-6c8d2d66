import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, Section, MiniBars, groupBy } from "./AnalyticsPrimitives";

type Note = { category: string; is_pinned: boolean };
type Screen = { is_active: boolean; current_content_type: string };

export function MediaAnalytics() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [n, s] = await Promise.all([
        supabase.from("av_notes").select("category,is_pinned"),
        supabase.from("display_screens").select("is_active,current_content_type"),
      ]);
      setNotes((n.data ?? []) as Note[]);
      setScreens((s.data ?? []) as Screen[]);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="text-xs text-muted-foreground">加载中…</div>;
  const byCat = groupBy(notes, (x) => x.category || "其他");
  const byType = groupBy(screens, (x) => x.current_content_type || "—");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="影音笔记" value={notes.length} hint={`${notes.filter(n=>n.is_pinned).length} 置顶`} />
        <StatCard label="活跃屏幕" value={screens.filter(s=>s.is_active).length} hint={`共 ${screens.length} 块`} />
      </div>
      <Section title="笔记分类"><MiniBars items={byCat} /></Section>
      <Section title="屏幕内容类型"><MiniBars items={byType} /></Section>
    </div>
  );
}