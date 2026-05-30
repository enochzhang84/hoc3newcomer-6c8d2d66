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
import { Plus, Search, Download, Trash2, Pencil, Paperclip, X, FileText } from "lucide-react";

type Note = {
  id: string;
  event_date: string;
  event_time: string | null;
  event_name: string;
  event_category: string;
  meal_type: string | null;
  attendees: number;
  organizer: string | null;
  phone: string | null;
  notes: string | null;
  attachments: string[];
  created_at: string;
  updated_at: string;
};

const EVENT_CATEGORIES = [
  "查经", "团契", "主日学", "执事会", "长老会",
  "退修会", "培训", "福音聚会", "特别聚会", "其他",
];
const MEAL_TYPES = ["早餐", "午餐", "晚餐", "茶点", "点心", "水果", "饮料", "其他"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthOf = (iso: string) => Number(iso.slice(5, 7));
const yearOf = (iso: string) => Number(iso.slice(0, 4));

const emptyForm = (): Omit<Note, "id" | "created_at" | "updated_at"> => ({
  event_date: todayISO(),
  event_time: "",
  event_name: "",
  event_category: "其他",
  meal_type: "午餐",
  attendees: 0,
  organizer: "",
  phone: "",
  notes: "",
  attachments: [],
});

export default function EventMealNotebook() {
  const [rows, setRows] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_meal_notes")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) toast.error("加载失败: " + error.message);
    else setRows((data ?? []) as Note[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => {
    const s = new Set<number>();
    rows.forEach(r => s.add(yearOf(r.event_date)));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return rows.filter(r => {
      if (year !== "all" && yearOf(r.event_date) !== Number(year)) return false;
      if (month !== "all" && monthOf(r.event_date) !== Number(month)) return false;
      if (from && r.event_date < from) return false;
      if (to && r.event_date > to) return false;
      if (kw) {
        const hay = [r.event_name, r.organizer, r.phone, r.notes, r.event_category, r.meal_type]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [rows, search, year, month, from, to]);

  const stats = useMemo(() => {
    const totalEvents = filtered.length;
    const totalAttendees = filtered.reduce((s, r) => s + (r.attendees || 0), 0);
    const byMeal: Record<string, number> = {};
    const byCat: Record<string, number> = {};
    const byMonth: Record<number, number> = {};
    filtered.forEach(r => {
      const mt = r.meal_type || "其他";
      byMeal[mt] = (byMeal[mt] || 0) + 1;
      byCat[r.event_category] = (byCat[r.event_category] || 0) + 1;
      const m = monthOf(r.event_date);
      byMonth[m] = (byMonth[m] || 0) + (r.attendees || 0);
    });
    const topMeal = Object.entries(byMeal).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    return { totalEvents, totalAttendees, byMeal, byCat, byMonth, topMeal, topCat };
  }, [filtered]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };
  const openEdit = (n: Note) => {
    setEditing(n);
    setForm({
      event_date: n.event_date,
      event_time: n.event_time ?? "",
      event_name: n.event_name,
      event_category: n.event_category,
      meal_type: n.meal_type ?? "",
      attendees: n.attendees,
      organizer: n.organizer ?? "",
      phone: n.phone ?? "",
      notes: n.notes ?? "",
      attachments: n.attachments ?? [],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.event_name.trim()) { toast.error("请填写活动名称"); return; }
    if (!form.event_date) { toast.error("请选择活动日期"); return; }
    const payload = {
      ...form,
      event_time: form.event_time || null,
      meal_type: form.meal_type || null,
      organizer: form.organizer || null,
      phone: form.phone || null,
      notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from("event_meal_notes").update(payload).eq("id", editing.id);
      if (error) { toast.error("保存失败: " + error.message); return; }
      toast.success("已更新");
    } else {
      const { error } = await supabase.from("event_meal_notes").insert(payload);
      if (error) { toast.error("保存失败: " + error.message); return; }
      toast.success("已新增");
    }
    setOpen(false);
    void load();
  };

  const remove = async (n: Note) => {
    if (!confirm(`确认删除「${n.event_name}」?`)) return;
    const { error } = await supabase.from("event_meal_notes").delete().eq("id", n.id);
    if (error) { toast.error("删除失败: " + error.message); return; }
    toast.success("已删除");
    void load();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `event-meal/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("signage").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) { toast.error("上传失败: " + error.message); continue; }
      const { data } = supabase.storage.from("signage").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setUploading(false);
    if (urls.length) {
      setForm(f => ({ ...f, attachments: [...f.attachments, ...urls] }));
      toast.success(`上传了 ${urls.length} 个文件`);
    }
  };

  const removeAttachment = (url: string) => {
    setForm(f => ({ ...f, attachments: f.attachments.filter(a => a !== url) }));
  };

  const exportRows = () => filtered.map(r => ({
    日期: r.event_date,
    时间: r.event_time ?? "",
    活动名称: r.event_name,
    活动类别: r.event_category,
    饭食类型: r.meal_type ?? "",
    人数: r.attendees,
    负责人: r.organizer ?? "",
    联系电话: r.phone ?? "",
    备注: r.notes ?? "",
    附件数: (r.attachments || []).length,
  }));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "其他活动订餐");
    XLSX.writeFile(wb, `其他活动订餐_${todayISO()}.xlsx`);
  };
  const exportCSV = () => {
    const data = exportRows();
    if (!data.length) { toast.info("无数据可导出"); return; }
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `其他活动订餐_${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const exportPDF = () => window.print();

  const isImg = (u: string) => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u);
  const isPdf = (u: string) => /\.pdf(\?|$)/i.test(u);

  return (
    <div className="min-h-[60vh] rounded-2xl bg-[#fdfaf1] p-3 sm:p-6 print:bg-white">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-amber-900 mr-2">📝 其他活动订餐记事本</h2>
          <Button onClick={openNew} className="rounded-full shadow-sm">
            <Plus className="w-4 h-4 mr-1" /> 新增订餐记录
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => setShowReport(true)}>
            📈 年度饭食报告
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={exportExcel}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={exportPDF}>
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-amber-900">📅 年</span>
            <select className="rounded-md border px-2 py-1 text-sm" value={year} onChange={e => setYear(e.target.value)}>
              <option value="all">全部</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-amber-900">月</span>
            <select className="rounded-md border px-2 py-1 text-sm" value={month} onChange={e => setMonth(e.target.value)}>
              <option value="all">全部</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-amber-900">自定义</span>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-[140px]" />
            <span>至</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-[140px]" />
            {(from || to) && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setFrom(""); setTo(""); }}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜索活动 / 负责人 / 电话 / 备注"
              value={search} onChange={e => setSearch(e.target.value)}
              className="h-8 w-[220px]" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="活动总次数" value={stats.totalEvents} />
          <StatCard label="总订餐人数" value={stats.totalAttendees} />
          <StatCard label="最常活动" value={stats.topCat} />
          <StatCard label="最常饭食" value={stats.topMeal} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MEAL_TYPES.slice(0, 4).map(mt => (
            <StatCard key={mt} label={`${mt}次数`} value={stats.byMeal[mt] || 0} small />
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading && <div className="col-span-full text-center text-muted-foreground py-8">加载中…</div>}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            暂无记录，点击"➕ 新增订餐记录"开始
          </div>
        )}
        {filtered.map(n => (
          <div key={n.id} className="rounded-2xl bg-white shadow-sm border border-amber-100 p-4 flex flex-col gap-2 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-base font-semibold truncate">{n.event_name || "(未命名活动)"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {n.event_date}{n.event_time ? ` · ${n.event_time}` : ""}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 print:hidden">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(n)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove(n)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">{n.event_category}</span>
              {n.meal_type && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-900">{n.meal_type}</span>}
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">{n.attendees} 人</span>
            </div>
            {(n.organizer || n.phone) && (
              <div className="text-xs text-muted-foreground">
                {n.organizer ? `负责人: ${n.organizer}` : ""}{n.organizer && n.phone ? " · " : ""}{n.phone ?? ""}
              </div>
            )}
            {n.notes && <div className="text-sm whitespace-pre-wrap text-foreground/80 line-clamp-3">{n.notes}</div>}
            {n.attachments?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {n.attachments.map(u => (
                  <button key={u} onClick={() => setPreviewUrl(u)} className="block">
                    {isImg(u)
                      ? <img src={u} className="w-14 h-14 object-cover rounded-md border" alt="" />
                      : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs bg-muted/40">
                          <Paperclip className="w-3 h-3" /> {isPdf(u) ? "PDF" : "文件"}
                        </span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Editor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑订餐记录" : "新增订餐记录"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="活动日期 *">
              <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
            </Field>
            <Field label="活动时间">
              <Input type="time" value={form.event_time ?? ""} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
            </Field>
            <Field label="活动名称 *" full>
              <Input value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} placeholder="例：周五查经" />
            </Field>
            <Field label="活动类别">
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
                value={form.event_category} onChange={e => setForm(f => ({ ...f, event_category: e.target.value }))}>
                {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="饭食类型">
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
                value={form.meal_type ?? ""} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))}>
                <option value="">—</option>
                {MEAL_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="人数">
              <Input type="number" min={0} value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="负责人">
              <Input value={form.organizer ?? ""} onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))} />
            </Field>
            <Field label="联系电话">
              <Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="备注" full>
              <Textarea rows={3} value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <Field label="附件 (图片 / PDF)" full>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border cursor-pointer bg-white hover:bg-muted text-sm">
                  <Paperclip className="w-4 h-4" />
                  {uploading ? "上传中…" : "上传文件"}
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden"
                    onChange={e => { handleUpload(e.target.files); e.currentTarget.value = ""; }} />
                </label>
                {form.attachments.map(u => (
                  <div key={u} className="relative">
                    {isImg(u)
                      ? <img src={u} className="w-16 h-16 object-cover rounded-md border" alt="" />
                      : <div className="w-16 h-16 rounded-md border flex items-center justify-center text-xs bg-muted">
                          {isPdf(u) ? "PDF" : "文件"}
                        </div>}
                    <button type="button" onClick={() => removeAttachment(u)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment preview — images preview inline, PDFs/other open in a new tab to avoid ERR_BLOCKED_BY_CLIENT */}
      <Dialog open={!!previewUrl && !!previewUrl && isImg(previewUrl)} onOpenChange={o => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>附件预览</DialogTitle></DialogHeader>
          {previewUrl && isImg(previewUrl) && (
            <img src={previewUrl} className="max-h-[75vh] mx-auto" alt="" />
          )}
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
              打开原始文件
            </a>
          )}
        </DialogContent>
      </Dialog>

      {/* Annual report */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>📈 年度饭食报告</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-muted-foreground">
              范围：{year === "all" ? "全部年份" : `${year}年`}{month !== "all" ? ` · ${month}月` : ""}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="活动总次数" value={stats.totalEvents} />
              <StatCard label="订餐总人数" value={stats.totalAttendees} />
              <StatCard label="最常活动类型" value={stats.topCat} />
              <StatCard label="最常饭食类型" value={stats.topMeal} />
            </div>
            <div>
              <div className="font-medium mb-1">每月订餐人数</div>
              <div className="space-y-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const v = stats.byMonth[m] || 0;
                  const max = Math.max(...Object.values(stats.byMonth), 1);
                  return (
                    <div key={m} className="flex items-center gap-2">
                      <span className="w-10 text-xs text-muted-foreground">{m}月</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${(v / max) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">饭食类型分布</div>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_TYPES.map(mt => (
                  <span key={mt} className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 text-xs">
                    {mt}: {stats.byMeal[mt] || 0}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-amber-100 px-3 py-2 shadow-sm">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={small ? "text-base font-semibold" : "text-xl font-semibold text-amber-900"}>{value}</div>
    </div>
  );
}