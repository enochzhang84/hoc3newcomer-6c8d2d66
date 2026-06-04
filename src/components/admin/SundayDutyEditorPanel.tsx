import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { isCommunionSunday, toISO } from "@/lib/sunday-utils";

/**
 * 主日轮值录入（左右分栏紧凑版）
 * 左：讲员 / 司会 / 领诗 / 司琴
 * 右：圣餐(仅圣餐主日) / 厨房 / 堂务 / 插花
 * 录音投影 / 视频播放 数据由「影音投影」模块自动读取，此处仅提示。
 */

function currentSundayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

type WorshipRow = { preacher: string; host: string; song_leader: string; pianist: string };
type CommunionRow = { worker_1: string; worker_2: string };

const EMPTY_WORSHIP: WorshipRow = { preacher: "", host: "", song_leader: "", pianist: "" };
const EMPTY_COMMUNION: CommunionRow = { worker_1: "", worker_2: "" };

export function SundayDutyEditorPanel({
  sunday,
  onChangeSunday,
}: {
  sunday: string;
  onChangeSunday: (iso: string) => void;
}) {
  const [worship, setWorship] = useState<WorshipRow>(EMPTY_WORSHIP);
  const [communion, setCommunion] = useState<CommunionRow>(EMPTY_COMMUNION);
  const [kitchen, setKitchen] = useState("");
  const [custodial, setCustodial] = useState("");
  const [flower, setFlower] = useState("");
  const [saving, setSaving] = useState(false);
  const isCommunion = isCommunionSunday(sunday);

  const load = useCallback(async () => {
    const sb = supabase as any;
    const [w, c, k, cu, f] = await Promise.all([
      sb.from("worship_service_roles").select("*").eq("service_date", sunday).maybeSingle(),
      sb.from("communion_service").select("*").eq("service_date", sunday).maybeSingle(),
      sb.from("kitchen_duty").select("workers").eq("service_date", sunday).maybeSingle(),
      sb.from("custodial_duty").select("workers").eq("service_date", sunday).maybeSingle(),
      sb.from("flower_duty").select("workers").eq("service_date", sunday).maybeSingle(),
    ]);
    setWorship({
      preacher: w.data?.preacher ?? "",
      host: w.data?.host ?? "",
      song_leader: w.data?.song_leader ?? "",
      pianist: w.data?.pianist ?? "",
    });
    setCommunion({ worker_1: c.data?.worker_1 ?? "", worker_2: c.data?.worker_2 ?? "" });
    setKitchen(k.data?.workers ?? "");
    setCustodial(cu.data?.workers ?? "");
    setFlower(f.data?.workers ?? "");
  }, [sunday]);

  useEffect(() => { load(); }, [load]);

  async function copyLast() {
    const prev = toISO(new Date(new Date(sunday + "T00:00:00").getTime() - 7 * 86400_000));
    const sb = supabase as any;
    const [w, c, k, cu, f] = await Promise.all([
      sb.from("worship_service_roles").select("*").eq("service_date", prev).maybeSingle(),
      sb.from("communion_service").select("*").eq("service_date", prev).maybeSingle(),
      sb.from("kitchen_duty").select("workers").eq("service_date", prev).maybeSingle(),
      sb.from("custodial_duty").select("workers").eq("service_date", prev).maybeSingle(),
      sb.from("flower_duty").select("workers").eq("service_date", prev).maybeSingle(),
    ]);
    if (!w.data && !c.data && !k.data && !cu.data && !f.data) {
      return toast.error(`上周 ${prev} 暂无数据`);
    }
    if (w.data) setWorship({
      preacher: w.data.preacher ?? "", host: w.data.host ?? "",
      song_leader: w.data.song_leader ?? "", pianist: w.data.pianist ?? "",
    });
    if (c.data) setCommunion({ worker_1: c.data.worker_1 ?? "", worker_2: c.data.worker_2 ?? "" });
    if (k.data) setKitchen(k.data.workers ?? "");
    if (cu.data) setCustodial(cu.data.workers ?? "");
    if (f.data) setFlower(f.data.workers ?? "");
    toast.success(`已从 ${prev} 复制（记得保存）`);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const sb = supabase as any;
      const ops: Promise<any>[] = [
        sb.from("worship_service_roles").upsert({ service_date: sunday, ...worship }, { onConflict: "service_date" }),
        sb.from("kitchen_duty").upsert({ service_date: sunday, workers: kitchen }, { onConflict: "service_date" }),
        sb.from("custodial_duty").upsert({ service_date: sunday, workers: custodial }, { onConflict: "service_date" }),
        sb.from("flower_duty").upsert({ service_date: sunday, workers: flower }, { onConflict: "service_date" }),
      ];
      if (isCommunion) {
        ops.push(sb.from("communion_service").upsert({ service_date: sunday, ...communion }, { onConflict: "service_date" }));
      }
      const results = await Promise.all(ops);
      const err = results.find((r: any) => r?.error)?.error;
      if (err) return toast.error(err.message);
      toast.success("已全部保存");
      load();
    } finally {
      setSaving(false);
    }
  }

  const date = new Date(sunday + "T00:00:00");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="size-4" />
              {sunday}
              {isCommunion ? <span className="ml-1 text-xs text-amber-700">(圣餐主日)</span> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && onChangeSunday(toISO(currentSundayOf(d)))}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copyLast}>复制上周</Button>
          <Button size="sm" onClick={saveAll} disabled={saving}>{saving ? "保存中…" : "保存全部"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左：主日敬拜服事 */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground/80">主日敬拜服事</div>
          {([
            ["preacher", "讲员"], ["host", "司会"],
            ["song_leader", "领诗"], ["pianist", "司琴"],
          ] as const).map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                value={worship[k]}
                onChange={(e) => setWorship({ ...worship, [k]: e.target.value })}
                placeholder="待定"
              />
            </div>
          ))}
        </div>

        {/* 右：其他服事 */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground/80">其他服事</div>
          {isCommunion && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">圣餐服事 1</Label>
                <Input
                  value={communion.worker_1}
                  onChange={(e) => setCommunion({ ...communion, worker_1: e.target.value })}
                  placeholder="待定"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">圣餐服事 2</Label>
                <Input
                  value={communion.worker_2}
                  onChange={(e) => setCommunion({ ...communion, worker_2: e.target.value })}
                  placeholder="待定"
                />
              </div>
            </div>
          )}
          {!isCommunion && (
            <div className="text-[11px] text-muted-foreground border border-dashed rounded px-2 py-1.5">
              该主日非圣餐主日（每月第 1 个主日），周报将不显示「圣餐服事」。
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">厨房服事</Label>
            <Input value={kitchen} onChange={(e) => setKitchen(e.target.value)} placeholder="如：张三、李四" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">堂务</Label>
            <Input value={custodial} onChange={(e) => setCustodial(e.target.value)} placeholder="如：张三、李四" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">插花</Label>
            <Input value={flower} onChange={(e) => setFlower(e.target.value)} placeholder="如：张三" />
          </div>
          <div className="text-[11px] text-muted-foreground border border-dashed rounded px-2 py-1.5">
            录音投影 / 视频播放 由「影音投影 · 主日轮值」自动读取；招待 / 新人接待 由「接待事工 · 轮值表」自动读取。
          </div>
        </div>
      </div>
    </div>
  );
}