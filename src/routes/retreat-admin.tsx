import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import logo from "@/assets/logo.png";
import { pickVerse } from "./retreat-register";

export const Route = createFileRoute("/retreat-admin")({
  component: RetreatAdminPage,
});

type Row = {
  id: string;
  entry_no: number;
  confirmation_no: string | null;
  paid: boolean;
  church: string | null;
  serial_no: string | null;
  chinese_name: string;
  last_name: string | null;
  first_name: string | null;
  cell: string | null;
  email: string | null;
  gender: string | null;
  program: string | null;
  topic: string | null;
  bed: string | null;
  bus: string | null;
  can_pickup: number | null;
  need_pickup: number | null;
  user_notes: string | null;
  created_at: string;
  updated_at: string;
};

const CHURCHES = ["hoc1", "hoc2", "hoc3", "hoc4", "hoc5", "hoc6", "hoc7"];
const PROGRAMS = ["M", "E", "N", "S", "F", "T", "R", "B"];
const TOPICS = ["1", "2", "3", "4"];

function emptyForm() {
  return {
    church: "hoc3",
    chinese_name: "",
    last_name: "",
    first_name: "",
    gender: "",
    cell: "",
    email: "",
    program: "",
    topic: "",
    bed: "",
    can_pickup: "",
    need_pickup: "",
    user_notes: "",
  };
}

function RetreatAdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [search, setSearch] = useState("");
  const [regOpen, setRegOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        navigate({ to: "/login", search: { redirect: "/retreat-admin" } });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const ok = (roles ?? []).some((r) => r.role === "admin");
      setIsAdmin(ok);
      setChecking(false);
      if (ok) load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("retreat_registrations")
      .select("*")
      .order("entry_no", { ascending: true });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  }, []);

  if (checking) return <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>;
  if (!isAdmin) return (
    <div className="p-10 text-center text-sm">
      需要管理员权限。<Link to="/login" className="underline">去登录</Link>
    </div>
  );

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.chinese_name.toLowerCase().includes(s) ||
      (r.last_name ?? "").toLowerCase().includes(s) ||
      (r.first_name ?? "").toLowerCase().includes(s) ||
      (r.cell ?? "").toLowerCase().includes(s) ||
      (r.email ?? "").toLowerCase().includes(s)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const data = filtered.map((r, i) => ({
      "Entry #": r.entry_no,
      "Confirmation #": r.confirmation_no ?? "",
      "已付费?": r.paid ? "Y" : "",
      "基督之家": r.church ?? "",
      "序号": r.serial_no ?? (i + 1),
      "中文姓名": r.chinese_name,
      "LastName": r.last_name ?? "",
      "FirstName": r.first_name ?? "",
      "Cell": r.cell ?? "",
      "Email": r.email ?? "",
      "Gender": r.gender ?? "",
      "Program": r.program ?? "",
      "Topic": r.topic ?? "",
      "Bed": r.bed ?? "",
      "Bus": r.bus ?? "",
      "可接送": r.can_pickup ?? "",
      "需接送": r.need_pickup ?? "",
      "Creation Time": new Date(r.created_at).toLocaleString("zh-CN"),
      "Changed By": "",
      "Modify Time": new Date(r.updated_at).toLocaleString("zh-CN"),
      "userNotes": r.user_notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Object.keys(data[0] ?? {}).map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "退修会名单");
    XLSX.writeFile(wb, `退修会名单_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`已导出 ${data.length} 条`);
  }

  async function submitReg(e: React.FormEvent) {
    e.preventDefault();
    if (!form.chinese_name.trim()) return toast.error("请填写中文姓名");
    setSubmitting(true);
    const needPickup = parseInt(form.need_pickup || "0", 10) || 0;
    const canPickup = parseInt(form.can_pickup || "0", 10) || 0;
    const { error } = await supabase.from("retreat_registrations").insert({
      church: form.church || null,
      chinese_name: form.chinese_name.trim(),
      last_name: form.last_name.trim() || null,
      first_name: form.first_name.trim() || null,
      gender: form.gender || null,
      cell: form.cell.trim() || null,
      email: form.email.trim() || null,
      program: form.program || null,
      topic: form.topic || null,
      bed: form.bed || null,
      can_pickup: canPickup || null,
      need_pickup: needPickup || null,
      bus: needPickup > 0 ? "Y" : "N",
      user_notes: form.user_notes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    const v = pickVerse();
    toast.success(`登记成功 · 「${v.text}」— ${v.ref}`, { duration: 7000 });
    setForm(emptyForm());
    setRegOpen(false);
    load();
  }

  async function del(id: string, name: string) {
    if (!confirm(`删除 ${name} 的登记?`)) return;
    const { error } = await supabase.from("retreat_registrations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    load();
  }

  async function togglePaid(r: Row) {
    const { error } = await supabase
      .from("retreat_registrations")
      .update({ paid: !r.paid })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <h1 className="font-serif text-2xl">退修会名单</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin"><Button variant="ghost" size="sm">返回后台</Button></Link>
            <Link to="/retreat"><Button variant="outline" size="sm">扫码主页</Button></Link>
            <Button size="sm" onClick={() => setRegOpen(true)}>立即登记</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="text-sm text-muted-foreground">共 {filtered.length} 条登记</div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索姓名/电话/邮箱"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-56"
            />
            <Button onClick={exportExcel} disabled={filtered.length === 0}>导出 Excel</Button>
            <Button variant="outline" onClick={load}>刷新</Button>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-left text-muted-foreground border-b border-border/60">
                  {["Entry #","Confirmation #","已付费?","基督之家","序号","中文姓名","LastName","FirstName","Cell","Email","Gender","Program","Topic","Bed","可接送","需接送","Bus","Creation Time","Changed By","Modify Time","userNotes","操作"].map((h) => (
                    <th key={h} className="py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2">{r.entry_no}</td>
                    <td className="py-2 px-2">{r.confirmation_no ?? ""}</td>
                    <td className="py-2 px-2">
                      <button onClick={() => togglePaid(r)} className={r.paid ? "text-green-600" : "text-muted-foreground hover:text-foreground"}>
                        {r.paid ? "✓ 已付" : "未付"}
                      </button>
                    </td>
                    <td className="py-2 px-2">{r.church ?? ""}</td>
                    <td className="py-2 px-2">{r.serial_no ?? (page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="py-2 px-2 font-medium">{r.chinese_name}</td>
                    <td className="py-2 px-2">{r.last_name ?? ""}</td>
                    <td className="py-2 px-2">{r.first_name ?? ""}</td>
                    <td className="py-2 px-2">{r.cell ?? ""}</td>
                    <td className="py-2 px-2">{r.email ?? ""}</td>
                    <td className="py-2 px-2">{r.gender ?? ""}</td>
                    <td className="py-2 px-2">{r.program ?? ""}</td>
                    <td className="py-2 px-2">{r.topic ?? ""}</td>
                    <td className="py-2 px-2">{r.bed ?? ""}</td>
                    <td className="py-2 px-2">{r.bus ?? ""}</td>
                    <td className="py-2 px-2">{new Date(r.created_at).toLocaleString("zh-CN")}</td>
                    <td className="py-2 px-2"></td>
                    <td className="py-2 px-2">{new Date(r.updated_at).toLocaleString("zh-CN")}</td>
                    <td className="py-2 px-2 max-w-[200px] truncate" title={r.user_notes ?? ""}>{r.user_notes ?? ""}</td>
                    <td className="py-2 px-2">
                      <button onClick={() => del(r.id, r.chinese_name)} className="text-destructive hover:underline">删除</button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={20} className="py-10 text-center text-muted-foreground">暂无登记</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
          </div>
        )}
      </main>

      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>立即登记 · 退修会</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReg} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>基督之家分堂</Label>
                <select value={form.church} onChange={(e) => setForm({ ...form, church: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {CHURCHES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <Label>性别</Label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option><option value="M">M</option><option value="F">F</option>
                </select>
              </div>
            </div>
            <div>
              <Label>中文姓名 *</Label>
              <Input value={form.chinese_name} onChange={(e) => setForm({ ...form, chinese_name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Last Name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="mt-1" /></div>
              <div><Label>First Name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cell</Label><Input value={form.cell} onChange={(e) => setForm({ ...form, cell: e.target.value })} className="mt-1" /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Program</Label>
                <select value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option>{PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label>Topic</Label>
                <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option>{TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Bed</Label>
                <select value={form.bed} onChange={(e) => setForm({ ...form, bed: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option><option value="yes">占床位</option><option value="no">不占床位</option>
                </select>
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Textarea value={form.user_notes} onChange={(e) => setForm({ ...form, user_notes: e.target.value })} rows={2} className="mt-1" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">{submitting ? "提交中…" : "提交登记"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}