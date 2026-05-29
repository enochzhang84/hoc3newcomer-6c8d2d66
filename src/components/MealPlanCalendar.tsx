import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ChevronLeft, ChevronRight, Settings2, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MealType = { id: string; name: string; sort_order: number; is_active: boolean };
type MealPlan = {
  id: string;
  plan_date: string;
  attendees: number;
  meal_type: string | null;
  notes: string | null;
  category: string;
};
type Attendance = { record_date: string; worship_count: number };

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayISO = () => {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
};

export default function MealPlanCalendar({
  category,
  title,
}: {
  category: "sunday" | "event";
  title: string;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [attendance, setAttendance] = useState<Record<string, number>>({});
  const [editDate, setEditDate] = useState<string | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const [newType, setNewType] = useState("");

  const monthStart = useMemo(() => toISO(year, month, 1), [year, month]);
  const monthEnd = useMemo(() => {
    const last = new Date(year, month + 1, 0).getDate();
    return toISO(year, month, last);
  }, [year, month]);

  const load = useCallback(async () => {
    const [{ data: mt }, { data: mp }, { data: at }] = await Promise.all([
      supabase.from("meal_types").select("*").order("sort_order"),
      supabase
        .from("meal_plans")
        .select("*")
        .eq("category", category)
        .gte("plan_date", monthStart)
        .lte("plan_date", monthEnd),
      category === "sunday"
        ? supabase
            .from("attendance_records")
            .select("record_date,worship_count")
            .gte("record_date", monthStart)
            .lte("record_date", monthEnd)
        : Promise.resolve({ data: [] as Attendance[] }),
    ]);
    setMealTypes((mt as MealType[]) ?? []);
    setPlans(((mp as MealPlan[]) ?? []) as MealPlan[]);
    const m: Record<string, number> = {};
    for (const r of (at ?? []) as Attendance[]) m[r.record_date] = r.worship_count ?? 0;
    setAttendance(m);
  }, [category, monthStart, monthEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const planByDate = useMemo(() => {
    const m: Record<string, MealPlan> = {};
    for (const p of plans) m[p.plan_date] = p;
    return m;
  }, [plans]);

  // build calendar grid (sun-start)
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysIn = new Date(year, month + 1, 0).getDate();
    const arr: { date: string | null; day: number }[] = [];
    for (let i = 0; i < startDow; i++) arr.push({ date: null, day: 0 });
    for (let d = 1; d <= daysIn; d++) arr.push({ date: toISO(year, month, d), day: d });
    while (arr.length % 7 !== 0) arr.push({ date: null, day: 0 });
    return arr;
  }, [year, month]);

  const goPrev = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1);
  };

  const exportXlsx = async (scope: "month" | "all") => {
    let rows: MealPlan[] = [];
    if (scope === "month") {
      rows = plans.slice().sort((a, b) => a.plan_date.localeCompare(b.plan_date));
    } else {
      const { data } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("category", category)
        .order("plan_date");
      rows = ((data as MealPlan[]) ?? []) as MealPlan[];
    }
    const ws = XLSX.utils.json_to_sheet(
      rows.map((p) => ({
        日期: p.plan_date,
        就餐人数: p.attendees,
        饭食种类: p.meal_type ?? "",
        备注: p.notes ?? "",
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "订餐计划");
    const fname =
      scope === "month"
        ? `${title}_${year}-${pad(month + 1)}.xlsx`
        : `${title}_全部.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const editing = editDate
    ? planByDate[editDate] ?? {
        id: "",
        plan_date: editDate,
        attendees: attendance[editDate] ?? 0,
        meal_type: null,
        notes: null,
        category,
      }
    : null;

  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-serif text-xl">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i).map((y) => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: 12 }, (_, i) => i).map((m) => (
              <option key={m} value={m}>{m + 1} 月</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth()); }}>今天</Button>
          <Button size="sm" variant="outline" onClick={() => setTypesOpen(true)}>
            <Settings2 className="w-4 h-4 mr-1" />饭食种类
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportXlsx("month")}>
            <Download className="w-4 h-4 mr-1" />本月
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportXlsx("all")}>
            <Download className="w-4 h-4 mr-1" />全部
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs sm:text-sm text-muted-foreground border-b border-border/50 mb-1">
        {weekdays.map((w) => (
          <div key={w} className="py-2 text-center font-medium">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-square sm:aspect-[4/3] bg-muted/20 rounded-md" />;
          const p = planByDate[c.date];
          const autoAtt = attendance[c.date];
          const isToday = c.date === todayISO();
          return (
            <button
              key={i}
              onClick={() => setEditDate(c.date)}
              className={cn(
                "aspect-square sm:aspect-[4/3] min-h-[64px] rounded-md border text-left p-1.5 sm:p-2 flex flex-col gap-0.5 transition-all hover:border-primary/60 hover:bg-primary/5",
                isToday ? "border-primary bg-primary/10" : "border-border/50 bg-background",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs sm:text-sm font-medium", isToday && "text-primary")}>{c.day}</span>
                {p && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </div>
              {p ? (
                <div className="text-[10px] sm:text-xs leading-tight space-y-0.5 overflow-hidden">
                  <div className="font-medium">{p.attendees} 人</div>
                  {p.meal_type && <div className="text-muted-foreground truncate">{p.meal_type}</div>}
                </div>
              ) : autoAtt ? (
                <div className="text-[10px] sm:text-xs text-muted-foreground">出席 {autoAtt}</div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDate} onOpenChange={(o) => !o && setEditDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editDate} · {title}</DialogTitle>
          </DialogHeader>
          {editing && (
            <EditForm
              key={editDate}
              plan={editing}
              mealTypes={mealTypes}
              autoAttendees={category === "sunday" ? attendance[editDate!] : undefined}
              onSaved={() => { setEditDate(null); load(); }}
              onDeleted={() => { setEditDate(null); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Meal types manage */}
      <Dialog open={typesOpen} onOpenChange={setTypesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>饭食种类设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {mealTypes.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <Input
                  defaultValue={m.name}
                  onBlur={async (e) => {
                    const v = e.target.value.trim();
                    if (!v || v === m.name) return;
                    await supabase.from("meal_types").update({ name: v }).eq("id", m.id);
                    load();
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm("删除该饭食种类?")) return;
                    await supabase.from("meal_types").delete().eq("id", m.id);
                    load();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="新饭食种类名称"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            />
            <Button
              onClick={async () => {
                const v = newType.trim();
                if (!v) return;
                const { error } = await supabase.from("meal_types").insert({
                  name: v,
                  sort_order: (mealTypes.at(-1)?.sort_order ?? 0) + 1,
                });
                if (error) return toast.error(error.message);
                setNewType("");
                load();
              }}
            >
              添加
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EditForm({
  plan,
  mealTypes,
  autoAttendees,
  onSaved,
  onDeleted,
}: {
  plan: MealPlan;
  mealTypes: MealType[];
  autoAttendees?: number;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [attendees, setAttendees] = useState(String(plan.attendees ?? autoAttendees ?? 0));
  const [mealType, setMealType] = useState(plan.meal_type ?? "");
  const [notes, setNotes] = useState(plan.notes ?? "");

  const save = async () => {
    const att = parseInt(attendees || "0", 10) || 0;
    if (plan.id) {
      const { error } = await supabase.from("meal_plans").update({
        attendees: att,
        meal_type: mealType || null,
        notes: notes || null,
      }).eq("id", plan.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("meal_plans").insert({
        plan_date: plan.plan_date,
        attendees: att,
        meal_type: mealType || null,
        notes: notes || null,
        category: plan.category,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("已保存");
    onSaved();
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>就餐人数</Label>
        <Input type="number" min="0" value={attendees} onChange={(e) => setAttendees(e.target.value)} />
        {autoAttendees !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            出席记录主日崇拜人数：{autoAttendees}{" "}
            <button className="underline text-primary" onClick={() => setAttendees(String(autoAttendees))}>使用</button>
          </p>
        )}
      </div>
      <div>
        <Label>饭食种类</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
        >
          <option value="">—</option>
          {mealTypes.filter((m) => m.is_active).map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>备注</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <DialogFooter>
        {plan.id && (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              if (!confirm("删除该订餐计划?")) return;
              await supabase.from("meal_plans").delete().eq("id", plan.id);
              toast.success("已删除");
              onDeleted();
            }}
          >
            删除
          </Button>
        )}
        <Button onClick={save}>保存</Button>
      </DialogFooter>
    </div>
  );
}