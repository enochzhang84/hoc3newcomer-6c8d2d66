import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Decision = {
  id: string;
  decision_date: string;
  name: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  fellowship: string | null;
  source: string | null;
  follow_up_person: string | null;
  follow_up_status: string;
  is_baptized: boolean;
  notes: string | null;
};

type Baptism = {
  id: string;
  baptism_date: string;
  name: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  fellowship: string | null;
  baptizing_elder: string | null;
  baptism_type: string | null;
  decision_id: string | null;
  notes: string | null;
};

const STATUS_OPTS = [
  { v: "pending", label: "待跟进" },
  { v: "following", label: "跟进中" },
  { v: "stable", label: "稳定聚会" },
  { v: "lost", label: "失联" },
];

export function DecisionBaptismPanel() {
  const [tab, setTab] = useState<"decisions" | "baptisms">("decisions");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [baptisms, setBaptisms] = useState<Baptism[]>([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [editingDec, setEditingDec] = useState<Decision | null>(null);
  const [editingBap, setEditingBap] = useState<Baptism | null>(null);

  const load = async () => {
    setLoading(true);
    const [d, b] = await Promise.all([
      supabase.from("decisions").select("*").order("decision_date", { ascending: false }),
      supabase.from("baptisms").select("*").order("baptism_date", { ascending: false }),
    ]);
    if (d.data) setDecisions(d.data as Decision[]);
    if (b.data) setBaptisms(b.data as Baptism[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    decisions.forEach(d => ys.add(new Date(d.decision_date).getFullYear()));
    baptisms.forEach(b => ys.add(new Date(b.baptism_date).getFullYear()));
    return Array.from(ys).sort((a, b) => b - a);
  }, [decisions, baptisms]);

  const decYear = decisions.filter(d => new Date(d.decision_date).getFullYear() === year);
  const bapYear = baptisms.filter(b => new Date(b.baptism_date).getFullYear() === year);
  const conversionRate = decYear.length > 0
    ? Math.round((decYear.filter(d => d.is_baptized).length / decYear.length) * 100)
    : 0;

  // Year-over-year trend
  const trend = useMemo(() => {
    const map = new Map<number, { year: number; decisions: number; baptisms: number }>();
    decisions.forEach(d => {
      const y = new Date(d.decision_date).getFullYear();
      if (!map.has(y)) map.set(y, { year: y, decisions: 0, baptisms: 0 });
      map.get(y)!.decisions += 1;
    });
    baptisms.forEach(b => {
      const y = new Date(b.baptism_date).getFullYear();
      if (!map.has(y)) map.set(y, { year: y, decisions: 0, baptisms: 0 });
      map.get(y)!.baptisms += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.year - b.year);
  }, [decisions, baptisms]);

  const saveDecision = async () => {
    if (!editingDec) return;
    const payload = {
      decision_date: editingDec.decision_date,
      name: editingDec.name,
      gender: editingDec.gender,
      phone: editingDec.phone,
      email: editingDec.email,
      fellowship: editingDec.fellowship,
      source: editingDec.source,
      follow_up_person: editingDec.follow_up_person,
      follow_up_status: editingDec.follow_up_status,
      is_baptized: editingDec.is_baptized,
      notes: editingDec.notes,
    };
    const isNew = !editingDec.id;
    const { error } = isNew
      ? await supabase.from("decisions").insert(payload)
      : await supabase.from("decisions").update(payload).eq("id", editingDec.id);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "已新增决志记录" : "已保存");
    setEditingDec(null);
    load();
  };

  const saveBaptism = async () => {
    if (!editingBap) return;
    const payload = {
      baptism_date: editingBap.baptism_date,
      name: editingBap.name,
      gender: editingBap.gender,
      phone: editingBap.phone,
      email: editingBap.email,
      fellowship: editingBap.fellowship,
      baptizing_elder: editingBap.baptizing_elder,
      baptism_type: editingBap.baptism_type,
      decision_id: editingBap.decision_id,
      notes: editingBap.notes,
    };
    const isNew = !editingBap.id;
    const { error } = isNew
      ? await supabase.from("baptisms").insert(payload)
      : await supabase.from("baptisms").update(payload).eq("id", editingBap.id);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "已新增受洗记录" : "已保存");
    setEditingBap(null);
    load();
  };

  const delDecision = async (id: string) => {
    if (!confirm("确定删除该决志记录？")) return;
    const { error } = await supabase.from("decisions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    load();
  };

  const delBaptism = async (id: string) => {
    if (!confirm("确定删除该受洗记录？")) return;
    const { error } = await supabase.from("baptisms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    load();
  };

  const exportDecisions = () => {
    const ws = XLSX.utils.json_to_sheet(decYear.map(d => ({
      日期: d.decision_date, 姓名: d.name, 性别: d.gender ?? "", 电话: d.phone ?? "",
      邮箱: d.email ?? "", 团契: d.fellowship ?? "", 来源: d.source ?? "",
      跟进人: d.follow_up_person ?? "", 跟进状态: STATUS_OPTS.find(s => s.v === d.follow_up_status)?.label ?? d.follow_up_status,
      已受洗: d.is_baptized ? "是" : "否", 备注: d.notes ?? "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `决志_${year}`);
    XLSX.writeFile(wb, `决志记录_${year}.xlsx`);
  };

  const exportBaptisms = () => {
    const ws = XLSX.utils.json_to_sheet(bapYear.map(b => ({
      日期: b.baptism_date, 姓名: b.name, 性别: b.gender ?? "", 电话: b.phone ?? "",
      邮箱: b.email ?? "", 团契: b.fellowship ?? "", 施洗长老: b.baptizing_elder ?? "",
      受洗类型: b.baptism_type ?? "", 备注: b.notes ?? "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `受洗_${year}`);
    XLSX.writeFile(wb, `受洗记录_${year}.xlsx`);
  };

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">年份</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>刷新</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border/50 p-4 bg-background/50">
          <div className="text-xs text-muted-foreground">本年决志</div>
          <div className="text-2xl font-semibold mt-1">{decYear.length}</div>
        </div>
        <div className="rounded-xl border border-border/50 p-4 bg-background/50">
          <div className="text-xs text-muted-foreground">本年受洗</div>
          <div className="text-2xl font-semibold mt-1">{bapYear.length}</div>
        </div>
        <div className="rounded-xl border border-border/50 p-4 bg-background/50">
          <div className="text-xs text-muted-foreground">决志→受洗 转化率</div>
          <div className="text-2xl font-semibold mt-1">{conversionRate}%</div>
        </div>
        <div className="rounded-xl border border-border/50 p-4 bg-background/50">
          <div className="text-xs text-muted-foreground">累计决志 / 受洗</div>
          <div className="text-2xl font-semibold mt-1">{decisions.length} / {baptisms.length}</div>
        </div>
      </div>

      {/* Trend table */}
      {trend.length > 0 && (
        <div className="mb-6 rounded-xl border border-border/50 overflow-hidden">
          <div className="px-4 py-2 text-sm font-medium bg-muted/40">历年趋势</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">年份</th>
                <th className="text-left p-2">决志</th>
                <th className="text-left p-2">受洗</th>
                <th className="text-left p-2">转化率</th>
              </tr>
            </thead>
            <tbody>
              {trend.map(t => (
                <tr key={t.year} className="border-t border-border/30">
                  <td className="p-2">{t.year}</td>
                  <td className="p-2">{t.decisions}</td>
                  <td className="p-2">{t.baptisms}</td>
                  <td className="p-2">{t.decisions ? Math.round((t.baptisms / t.decisions) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="decisions">决志记录 ({decYear.length})</TabsTrigger>
          <TabsTrigger value="baptisms">受洗记录 ({bapYear.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="decisions" className="mt-4">
          <div className="flex justify-end gap-2 mb-3">
            <Button size="sm" variant="outline" onClick={exportDecisions}>📊 导出 Excel</Button>
            <Button size="sm" onClick={() => setEditingDec({
              id: "", decision_date: new Date().toISOString().slice(0, 10),
              name: "", gender: null, phone: null, email: null, fellowship: null,
              source: null, follow_up_person: null, follow_up_status: "pending",
              is_baptized: false, notes: null,
            })}>+ 新增决志</Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2">日期</th>
                  <th className="text-left p-2">姓名</th>
                  <th className="text-left p-2">团契</th>
                  <th className="text-left p-2">跟进人</th>
                  <th className="text-left p-2">跟进状态</th>
                  <th className="text-left p-2">已受洗</th>
                  <th className="text-right p-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {decYear.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">暂无 {year} 年记录</td></tr>
                )}
                {decYear.map(d => (
                  <tr key={d.id} className="border-t border-border/30">
                    <td className="p-2">{d.decision_date}</td>
                    <td className="p-2 font-medium">{d.name}</td>
                    <td className="p-2">{d.fellowship ?? "—"}</td>
                    <td className="p-2">{d.follow_up_person ?? "—"}</td>
                    <td className="p-2">{STATUS_OPTS.find(s => s.v === d.follow_up_status)?.label ?? d.follow_up_status}</td>
                    <td className="p-2">{d.is_baptized ? "✅" : "—"}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditingDec(d)}>编辑</Button>
                      <Button size="sm" variant="ghost" onClick={() => delDecision(d.id)}>删除</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="baptisms" className="mt-4">
          <div className="flex justify-end gap-2 mb-3">
            <Button size="sm" variant="outline" onClick={exportBaptisms}>📊 导出 Excel</Button>
            <Button size="sm" onClick={() => setEditingBap({
              id: "", baptism_date: new Date().toISOString().slice(0, 10),
              name: "", gender: null, phone: null, email: null, fellowship: null,
              baptizing_elder: null, baptism_type: null, decision_id: null, notes: null,
            })}>+ 新增受洗</Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2">日期</th>
                  <th className="text-left p-2">姓名</th>
                  <th className="text-left p-2">团契</th>
                  <th className="text-left p-2">施洗长老</th>
                  <th className="text-left p-2">类型</th>
                  <th className="text-right p-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {bapYear.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">暂无 {year} 年记录</td></tr>
                )}
                {bapYear.map(b => (
                  <tr key={b.id} className="border-t border-border/30">
                    <td className="p-2">{b.baptism_date}</td>
                    <td className="p-2 font-medium">{b.name}</td>
                    <td className="p-2">{b.fellowship ?? "—"}</td>
                    <td className="p-2">{b.baptizing_elder ?? "—"}</td>
                    <td className="p-2">{b.baptism_type ?? "—"}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditingBap(b)}>编辑</Button>
                      <Button size="sm" variant="ghost" onClick={() => delBaptism(b.id)}>删除</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Decision edit dialog */}
      <Dialog open={!!editingDec} onOpenChange={(o) => !o && setEditingDec(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingDec?.id ? "编辑" : "新增"}决志记录</DialogTitle></DialogHeader>
          {editingDec && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>日期 *</Label>
                <Input type="date" value={editingDec.decision_date}
                  onChange={(e) => setEditingDec({ ...editingDec, decision_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>姓名 *</Label>
                <Input value={editingDec.name}
                  onChange={(e) => setEditingDec({ ...editingDec, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>性别</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={editingDec.gender ?? ""}
                  onChange={(e) => setEditingDec({ ...editingDec, gender: e.target.value || null })}>
                  <option value="">—</option><option value="男">男</option><option value="女">女</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>电话</Label>
                <Input value={editingDec.phone ?? ""}
                  onChange={(e) => setEditingDec({ ...editingDec, phone: e.target.value || null })} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>邮箱</Label>
                <Input value={editingDec.email ?? ""}
                  onChange={(e) => setEditingDec({ ...editingDec, email: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>团契</Label>
                <Input value={editingDec.fellowship ?? ""}
                  onChange={(e) => setEditingDec({ ...editingDec, fellowship: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>来源</Label>
                <Input value={editingDec.source ?? ""} placeholder="如：主日 / 福音聚会"
                  onChange={(e) => setEditingDec({ ...editingDec, source: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>跟进人</Label>
                <Input value={editingDec.follow_up_person ?? ""}
                  onChange={(e) => setEditingDec({ ...editingDec, follow_up_person: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>跟进状态</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={editingDec.follow_up_status}
                  onChange={(e) => setEditingDec({ ...editingDec, follow_up_status: e.target.value })}>
                  {STATUS_OPTS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editingDec.is_baptized}
                    onChange={(e) => setEditingDec({ ...editingDec, is_baptized: e.target.checked })} />
                  已受洗
                </label>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>备注</Label>
                <Textarea rows={3} value={editingDec.notes ?? ""}
                  onChange={(e) => setEditingDec({ ...editingDec, notes: e.target.value || null })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDec(null)}>取消</Button>
            <Button onClick={saveDecision}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baptism edit dialog */}
      <Dialog open={!!editingBap} onOpenChange={(o) => !o && setEditingBap(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBap?.id ? "编辑" : "新增"}受洗记录</DialogTitle></DialogHeader>
          {editingBap && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>日期 *</Label>
                <Input type="date" value={editingBap.baptism_date}
                  onChange={(e) => setEditingBap({ ...editingBap, baptism_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>姓名 *</Label>
                <Input value={editingBap.name}
                  onChange={(e) => setEditingBap({ ...editingBap, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>性别</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={editingBap.gender ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, gender: e.target.value || null })}>
                  <option value="">—</option><option value="男">男</option><option value="女">女</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>电话</Label>
                <Input value={editingBap.phone ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, phone: e.target.value || null })} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>邮箱</Label>
                <Input value={editingBap.email ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, email: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>团契</Label>
                <Input value={editingBap.fellowship ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, fellowship: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>施洗长老</Label>
                <Input value={editingBap.baptizing_elder ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, baptizing_elder: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>受洗类型</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={editingBap.baptism_type ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, baptism_type: e.target.value || null })}>
                  <option value="">—</option>
                  <option value="浸水礼">浸水礼</option>
                  <option value="点水礼">点水礼</option>
                  <option value="转会">转会</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>关联决志记录</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={editingBap.decision_id ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, decision_id: e.target.value || null })}>
                  <option value="">—</option>
                  {decisions.map(d => (
                    <option key={d.id} value={d.id}>{d.decision_date} · {d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>备注</Label>
                <Textarea rows={3} value={editingBap.notes ?? ""}
                  onChange={(e) => setEditingBap({ ...editingBap, notes: e.target.value || null })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBap(null)}>取消</Button>
            <Button onClick={saveBaptism}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}