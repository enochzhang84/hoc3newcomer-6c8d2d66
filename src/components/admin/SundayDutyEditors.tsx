import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isCommunionSunday, toISO } from "@/lib/sunday-utils";

/** 主日轮值录入入口（讲员/司会/领诗/司琴 · 圣餐 · 厨房 · 堂务 · 插花） */

function currentSundayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function DatePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const date = new Date(value + "T00:00:00");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="size-4" />
          {value}
          {isCommunionSunday(value) ? <span className="ml-1 text-xs text-amber-700">(圣餐主日)</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(toISO(currentSundayOf(d)))}
          initialFocus
          className="pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

/* ---------- 讲员 / 司会 / 领诗 / 司琴 ---------- */
type WorshipRow = { service_date: string; preacher: string | null; host: string | null; song_leader: string | null; pianist: string | null };

function WorshipRolesEditor({ sunday, onChange }: { sunday: string; onChange: (s: string) => void }) {
  const [row, setRow] = useState<WorshipRow | null>(null);
  const [form, setForm] = useState({ preacher: "", host: "", song_leader: "", pianist: "" });

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("worship_service_roles").select("*").eq("service_date", sunday).maybeSingle();
    setRow(data ?? null);
    setForm({
      preacher: data?.preacher ?? "",
      host: data?.host ?? "",
      song_leader: data?.song_leader ?? "",
      pianist: data?.pianist ?? "",
    });
  }, [sunday]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const payload = { service_date: sunday, ...form };
    const { error } = await (supabase as any).from("worship_service_roles").upsert(payload, { onConflict: "service_date" });
    if (error) return toast.error(error.message);
    toast.success("已保存");
    load();
  }
  async function copyLast() {
    const prev = toISO(new Date(new Date(sunday + "T00:00:00").getTime() - 7 * 86400_000));
    const { data } = await (supabase as any).from("worship_service_roles").select("*").eq("service_date", prev).maybeSingle();
    if (!data) return toast.error(`上周 ${prev} 暂无数据`);
    setForm({ preacher: data.preacher ?? "", host: data.host ?? "", song_leader: data.song_leader ?? "", pianist: data.pianist ?? "" });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DatePicker value={sunday} onChange={onChange} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copyLast}>复制上周</Button>
          <Button size="sm" onClick={save}>保存</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {([
          ["preacher", "讲员"], ["host", "司会"], ["song_leader", "领诗"], ["pianist", "司琴"],
        ] as const).map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder="待定" />
          </div>
        ))}
      </div>
      {row ? null : <div className="text-xs text-muted-foreground">该主日尚未录入</div>}
    </div>
  );
}

/* ---------- 圣餐服事 ---------- */
function CommunionEditor({ sunday, onChange }: { sunday: string; onChange: (s: string) => void }) {
  const isCommunion = isCommunionSunday(sunday);
  const [form, setForm] = useState({ worker_1: "", worker_2: "" });
  const [exists, setExists] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("communion_service").select("*").eq("service_date", sunday).maybeSingle();
    setExists(!!data);
    setForm({ worker_1: data?.worker_1 ?? "", worker_2: data?.worker_2 ?? "" });
  }, [sunday]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const { error } = await (supabase as any).from("communion_service").upsert({ service_date: sunday, ...form }, { onConflict: "service_date" });
    if (error) return toast.error(error.message);
    toast.success("已保存");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DatePicker value={sunday} onChange={onChange} />
        <Button size="sm" onClick={save} disabled={!isCommunion}>保存</Button>
      </div>
      {!isCommunion && (
        <div className="text-xs text-amber-700 border border-amber-200 bg-amber-50 rounded p-2">
          该主日非圣餐主日（每月第 1 个主日），周报将不会显示「圣餐服事」一项。
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">圣餐服事人员 1</Label>
          <Input value={form.worker_1} onChange={(e) => setForm({ ...form, worker_1: e.target.value })} placeholder="待定" disabled={!isCommunion} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">圣餐服事人员 2</Label>
          <Input value={form.worker_2} onChange={(e) => setForm({ ...form, worker_2: e.target.value })} placeholder="待定" disabled={!isCommunion} />
        </div>
      </div>
      {exists ? null : <div className="text-xs text-muted-foreground">该主日尚未录入</div>}
    </div>
  );
}

/* ---------- 通用单字段（厨房 / 堂务 / 插花） ---------- */
function SimpleWorkersEditor({
  table, sunday, onChange, label, placeholder,
}: {
  table: "kitchen_duty" | "custodial_duty" | "flower_duty";
  sunday: string; onChange: (s: string) => void;
  label: string; placeholder: string;
}) {
  const [value, setValue] = useState("");
  const [exists, setExists] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from(table).select("workers").eq("service_date", sunday).maybeSingle();
    setExists(!!data);
    setValue(data?.workers ?? "");
  }, [table, sunday]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const { error } = await (supabase as any).from(table).upsert({ service_date: sunday, workers: value }, { onConflict: "service_date" });
    if (error) return toast.error(error.message);
    toast.success("已保存");
    load();
  }
  async function copyLast() {
    const prev = toISO(new Date(new Date(sunday + "T00:00:00").getTime() - 7 * 86400_000));
    const { data } = await (supabase as any).from(table).select("workers").eq("service_date", prev).maybeSingle();
    if (!data) return toast.error(`上周 ${prev} 暂无数据`);
    setValue(data.workers ?? "");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DatePicker value={sunday} onChange={onChange} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copyLast}>复制上周</Button>
          <Button size="sm" onClick={save}>保存</Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        <div className="text-[11px] text-muted-foreground">多人请用顿号「、」或换行分隔</div>
      </div>
      {exists ? null : <div className="text-xs text-muted-foreground">该主日尚未录入</div>}
    </div>
  );
}

export function SundayDutyEditors() {
  const today = useMemo(() => new Date(), []);
  const [sunday, setSunday] = useState<string>(toISO(currentSundayOf(today)));

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 print:hidden">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-serif text-xl">主日轮值录入</h2>
          <p className="text-xs text-muted-foreground mt-1">按主日日期录入；周报「圣工轮值表（今日）」自动读取，未录入显示「待定」。</p>
        </div>
      </div>

      <Tabs defaultValue="worship">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="worship">主日敬拜服侍</TabsTrigger>
          <TabsTrigger value="communion">圣餐服事</TabsTrigger>
          <TabsTrigger value="kitchen">厨房服事</TabsTrigger>
          <TabsTrigger value="custodial">堂务</TabsTrigger>
          <TabsTrigger value="flower">插花</TabsTrigger>
        </TabsList>
        <TabsContent value="worship" className="pt-4">
          <WorshipRolesEditor sunday={sunday} onChange={setSunday} />
        </TabsContent>
        <TabsContent value="communion" className="pt-4">
          <CommunionEditor sunday={sunday} onChange={setSunday} />
        </TabsContent>
        <TabsContent value="kitchen" className="pt-4">
          <SimpleWorkersEditor table="kitchen_duty" sunday={sunday} onChange={setSunday} label="厨房服事人员" placeholder="如：张三、李四" />
        </TabsContent>
        <TabsContent value="custodial" className="pt-4">
          <SimpleWorkersEditor table="custodial_duty" sunday={sunday} onChange={setSunday} label="堂务人员" placeholder="如：张三、李四" />
        </TabsContent>
        <TabsContent value="flower" className="pt-4">
          <SimpleWorkersEditor table="flower_duty" sunday={sunday} onChange={setSunday} label="插花服事人员" placeholder="如：张三" />
        </TabsContent>
      </Tabs>
    </section>
  );
}