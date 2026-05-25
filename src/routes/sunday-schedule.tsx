import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/sunday-schedule")({
  component: SundaySchedulePage,
});

type Row = {
  id: string;
  slot_time: string;
  course_name: string | null;
  teacher_name: string | null;
  sort_order: number;
};
type Course = { id: string; name: string; is_active: boolean; sort_order: number };
type Teacher = { id: string; name: string; is_active: boolean; sort_order: number };

function SundaySchedulePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newSlot, setNewSlot] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newTeacher, setNewTeacher] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        navigate({ to: "/login", search: { redirect: "/sunday-schedule" } });
        return;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const ok = (roles ?? []).some((r) => r.role === "admin");
      setIsAdmin(ok);
      setChecking(false);
      if (ok) loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = useCallback(async () => {
    const [{ data: r }, { data: c }, { data: t }] = await Promise.all([
      (supabase as any).from("sunday_class_schedule").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("sunday_school_courses").select("*").order("sort_order", { ascending: true }),
      (supabase as any).from("sunday_school_teachers").select("*").order("sort_order", { ascending: true }),
    ]);
    setRows((r ?? []) as Row[]);
    setCourses((c ?? []) as Course[]);
    setTeachers((t ?? []) as Teacher[]);
  }, []);

  if (checking) return <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>;
  if (!isAdmin)
    return (
      <div className="p-10 text-center text-sm">
        需要管理员权限。<Link to="/login" className="underline">去登录</Link>
      </div>
    );

  async function addRow() {
    if (!newSlot.trim()) return toast.error("请填写时间");
    const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await (supabase as any).from("sunday_class_schedule").insert({
      slot_time: newSlot.trim(),
      course_name: newCourse || null,
      teacher_name: newTeacher || null,
      sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    setNewSlot(""); setNewCourse(""); setNewTeacher("");
    toast.success("已添加");
    loadAll();
  }

  async function updateRow(id: string, patch: Partial<Row>) {
    const { error } = await (supabase as any).from("sunday_class_schedule").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    loadAll();
  }

  async function delRow(id: string) {
    if (!confirm("删除此行?")) return;
    const { error } = await (supabase as any).from("sunday_class_schedule").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    loadAll();
  }

  function exportExcel() {
    const data = rows.map((r, i) => ({
      "序号": i + 1,
      "时间": r.slot_time,
      "课程": r.course_name ?? "",
      "老师": r.teacher_name ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "主日学课程表");
    XLSX.writeFile(wb, `主日学课程表_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`已导出 ${data.length} 条`);
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{`@media print { .no-print { display:none !important; } @page { margin: 1.5cm; } body { background:#fff; } }`}</style>
      <header className="border-b border-border/60 no-print">
        <div className="container mx-auto flex items-center justify-between px-6 py-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <h1 className="font-serif text-2xl">主日学课程表</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin"><Button variant="ghost" size="sm">返回后台</Button></Link>
            <Button size="sm" variant="outline" onClick={printPage}>打印</Button>
            <Button size="sm" onClick={exportExcel} disabled={rows.length === 0}>导出 Excel</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 print:py-0 print:px-0">
        <div className="hidden print:block mb-6 text-center">
          <h1 className="font-serif text-3xl">主日学课程表</h1>
          <p className="text-sm text-muted-foreground mt-1">{new Date().toLocaleDateString("zh-CN")}</p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left text-muted-foreground border-b border-border/60">
                <th className="py-2 px-3 w-16">序号</th>
                <th className="py-2 px-3">时间</th>
                <th className="py-2 px-3">课程</th>
                <th className="py-2 px-3">老师</th>
                <th className="py-2 px-3 text-right w-20 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 px-3">
                    <Input
                      defaultValue={r.slot_time}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== r.slot_time) updateRow(r.id, { slot_time: v });
                      }}
                      className="h-8 print:border-0 print:shadow-none print:px-0"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={r.course_name ?? ""}
                      onChange={(e) => updateRow(r.id, { course_name: e.target.value || null })}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm print:border-0 print:bg-transparent"
                    >
                      <option value="">—</option>
                      {courses.filter((c) => c.is_active).map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      {r.course_name && !courses.some((c) => c.name === r.course_name) && (
                        <option value={r.course_name}>{r.course_name}</option>
                      )}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={r.teacher_name ?? ""}
                      onChange={(e) => updateRow(r.id, { teacher_name: e.target.value || null })}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm print:border-0 print:bg-transparent"
                    >
                      <option value="">—</option>
                      {teachers.filter((t) => t.is_active).map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                      {r.teacher_name && !teachers.some((t) => t.name === r.teacher_name) && (
                        <option value={r.teacher_name}>{r.teacher_name}</option>
                      )}
                    </select>
                  </td>
                  <td className="py-2 px-3 text-right no-print">
                    <button onClick={() => delRow(r.id)} className="text-xs text-destructive hover:underline">
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">暂无课程，请在下方添加</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 bg-card border border-border/50 rounded-2xl p-4 no-print">
          <h3 className="font-medium mb-3">新增一行</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="时间，例如 09:30 - 10:30" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
            <select value={newCourse} onChange={(e) => setNewCourse(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">选择课程</option>
              {courses.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">选择老师</option>
              {teachers.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <Button onClick={addRow}>添加</Button>
          </div>
          {teachers.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              暂无老师，请到后台「主日学 → 设置 → 老师管理」添加。
            </p>
          )}
        </div>
      </main>
    </div>
  );
}