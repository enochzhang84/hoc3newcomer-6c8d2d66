import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { listUsersWithRoles, setUserAdmin, deleteUser } from "@/lib/users.functions";
import { updateRegistration } from "@/lib/registrations.functions";

type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  district: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  age_group: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  faith: string | null;
  faith_years: number | null;
  faith_other: string | null;
  marital_status: string | null;
  spouse_name: string | null;
  referrer_type: string | null;
  invited_by: string | null;
  referrer_other: string | null;
  wants_visit: boolean | null;
  wants_info: boolean | null;
  notes: string | null;
  source: string;
  created_at: string;
  event_id: string | null;
};

type Event = { id: string; name: string; qr_token: string; is_active: boolean };

type AppUser = { id: string; email: string; created_at: string; roles: string[] };

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [dateFilterMode, setDateFilterMode] = useState<"day" | "after" | "before">("day");
  const [dateOpen, setDateOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const fetchUsersFn = useServerFn(listUsersWithRoles);
  const setUserAdminFn = useServerFn(setUserAdmin);
  const deleteUserFn = useServerFn(deleteUser);
  const updateRegFn = useServerFn(updateRegistration);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Reg | null>(null);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await fetchUsersFn();
      setUsers(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUsersLoading(false);
    }
  }, [fetchUsersFn]);

  useEffect(() => setOrigin(window.location.origin), []);

  const loadData = useCallback(async () => {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from("registrations").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("created_at", { ascending: true }),
    ]);
    setRegs(r ?? []);
    setEvents(e ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/login" });
        return;
      }
      setCurrentUserId(session.session.user.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id);
      const admin = roles?.some((r) => r.role === "admin") ?? false;
      setIsAdmin(admin);
      setChecking(false);
      if (admin) {
        loadData();
        loadUsers();
      }
    })();
  }, [navigate, loadData, loadUsers]);

  // Realtime auto-update of new registrations
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("regs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "registrations" }, (payload) => {
        setRegs((prev) => [payload.new as Reg, ...prev]);
        toast.success(`新登记:${(payload.new as Reg).name}`);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin]);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中...</div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">您当前账号不是管理员</p>
        <Button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>退出登录</Button>
      </div>
    );
  }

  const eventMap = Object.fromEntries(events.map((e) => [e.id, e.name]));
  const filtered = regs.filter((r) => {
    const matchesSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone ?? "").includes(search);
    if (!filterDate) return matchesSearch;
    // Compare in browser local timezone (e.g. America/Los_Angeles)
    const d = new Date(r.created_at);
    const start = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 0, 0, 0, 0);
    const end = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate() + 1, 0, 0, 0, 0);
    const matchesDate =
      dateFilterMode === "day" ? d >= start && d < end :
      dateFilterMode === "after" ? d >= end :
      d < start;
    return matchesSearch && matchesDate;
  });

  function exportExcel() {
    const rows = filtered.map((r) => ({
      姓名中: r.name,
      姓名英: r.name_en ?? "",
      区别: r.district ?? "",
      性别: r.gender ?? "",
      年龄段: r.age_group ?? "",
      电话: r.phone ?? "",
      电邮: r.email ?? "",
      地址: r.address ?? "",
      City: r.city ?? "",
      ZIP: r.zip ?? "",
      信仰: r.faith === "christian" ? "基督徒" : r.faith === "seeker" ? "慕道友" : r.faith === "other" ? `其他:${r.faith_other ?? ""}` : "",
      信主年数: r.faith_years ?? "",
      婚姻: r.marital_status === "married" ? "已婚" : r.marital_status === "single" ? "单身" : "",
      配偶: r.spouse_name ?? "",
      介绍人: r.referrer_type === "self" ? "自己" : r.referrer_type === "friend" ? `亲友:${r.invited_by ?? ""}` : r.referrer_type === "other" ? `其他:${r.referrer_other ?? ""}` : "",
      欢迎探访: r.wants_visit ? "是" : "否",
      需要资料: r.wants_info ? "是" : "否",
      备注: r.notes ?? "",
      来源: r.source === "qr" ? "扫码" : "手动",
      活动: r.event_id ? eventMap[r.event_id] ?? "" : "",
      登记时间: new Date(r.created_at).toLocaleString("zh-CN"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "新人登记");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `新人登记_${date}.xlsx`);
    toast.success(`已导出 ${rows.length} 条记录`);
  }

  async function addEvent() {
    const { error } = await supabase.from("events").insert({ name: "新人登记" });
    if (error) toast.error(error.message);
    else {
      loadData();
      toast.success("新二维码已生成");
    }
  }

  async function deleteReg(id: string) {
    if (!confirm("确认删除此登记?")) return;
    const { error } = await supabase.from("registrations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setRegs((prev) => prev.filter((r) => r.id !== id));
      toast.success("已删除");
    }
  }

  async function saveEdit() {
    if (!editForm) return;
    if (!editForm.name.trim()) {
      toast.error("请填写中文姓名");
      return;
    }
    try {
      await updateRegFn({
        data: {
          id: editForm.id,
          name: editForm.name.trim(),
          name_en: editForm.name_en?.trim() || null,
          district: editForm.district?.trim() || null,
          gender: editForm.gender || null,
          age_group: editForm.age_group || null,
          address: editForm.address?.trim() || null,
          city: editForm.city?.trim() || null,
          zip: editForm.zip?.trim() || null,
          phone: editForm.phone?.trim() || null,
          email: editForm.email?.trim() || null,
          faith: editForm.faith || null,
          faith_years: editForm.faith === "christian" && editForm.faith_years ? Number(editForm.faith_years) : null,
          faith_other: editForm.faith === "other" ? editForm.faith_other?.trim() || null : null,
          marital_status: editForm.marital_status || null,
          spouse_name: editForm.marital_status === "married" ? editForm.spouse_name?.trim() || null : null,
          referrer_type: editForm.referrer_type || null,
          invited_by: editForm.referrer_type === "friend" ? editForm.invited_by?.trim() || null : null,
          referrer_other: editForm.referrer_type === "other" ? editForm.referrer_other?.trim() || null : null,
          wants_visit: editForm.wants_visit ?? false,
          wants_info: editForm.wants_info ?? false,
          notes: editForm.notes?.trim() || null,
        },
      });
      setEditOpen(false);
      setEditForm(null);
      toast.success("已保存");
      loadData();
    } catch (e) {
      toast.error("保存失败:" + (e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-xl">基督之家第三家 · 后台</Link>
          <div className="flex items-center gap-2">
            <Link to="/register" target="_blank">
              <Button size="sm">手动录入</Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
            >
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="总登记数" value={regs.length} />
          <Stat label="希望探访" value={regs.filter((r) => r.wants_visit).length} />
          <Stat label="需要资料" value={regs.filter((r) => r.wants_info).length} />
          <Stat label="活动数" value={events.length} />
        </div>

        {/* Events / QR */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-xl mb-4">活动与二维码</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button onClick={addEvent}>生成新二维码</Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => {
              const url = `${origin}/register?event=${ev.qr_token}`;
              return (
                <div key={ev.id} className="border border-border/50 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{ev.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{url}</p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">二维码</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{ev.name}</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col items-center gap-4 py-4">
                        <QRCodeSVG value={url} size={280} level="H" />
                        <p className="text-xs text-muted-foreground break-all text-center">{url}</p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            toast.success("链接已复制");
                          }}
                        >
                          复制链接
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })}
          </div>
        </section>

        {/* Registrations */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-xl">登记名单</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-1",
                      filterDate && "border-primary text-primary"
                    )}
                  >
                    <CalendarIcon className="size-4" />
                    {filterDate ? format(filterDate, "MM/dd", { locale: zhCN }) : "日期筛选"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="end">
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={setFilterDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                  <div className="border-t border-border/60 mt-2 pt-2">
                    <RadioGroup
                      value={dateFilterMode}
                      onValueChange={(v) => setDateFilterMode(v as "day" | "after" | "before")}
                      className="flex gap-4 px-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="day" id="day" />
                        <Label htmlFor="day" className="text-xs cursor-pointer">当日</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="after" id="after" />
                        <Label htmlFor="after" className="text-xs cursor-pointer">之后</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="before" id="before" />
                        <Label htmlFor="before" className="text-xs cursor-pointer">以前</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-border/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterDate(undefined);
                        setDateOpen(false);
                      }}
                    >
                      清除
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setDateOpen(false)}
                      disabled={!filterDate}
                    >
                      应用
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {filterDate && (
                <span className="text-xs text-muted-foreground">
                  {dateFilterMode === "day" ? "=" : dateFilterMode === "after" ? ">" : "<"} {format(filterDate, "yyyy-MM-dd", { locale: zhCN })}
                </span>
              )}
              <Input
                placeholder="搜索姓名或电话"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Button variant="outline" onClick={() => window.open("/today-preview", "_blank")}>
                今日预览
              </Button>
              <Button onClick={exportExcel} disabled={filtered.length === 0}>
                导出 Excel
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground">
                  <th className="py-2 px-2">姓名(中)</th>
                  <th className="py-2 px-2">姓名(英)</th>
                  <th className="py-2 px-2">区别</th>
                  <th className="py-2 px-2">性别</th>
                  <th className="py-2 px-2">年龄</th>
                  <th className="py-2 px-2">电话</th>
                  <th className="py-2 px-2">电邮</th>
                  <th className="py-2 px-2">地址</th>
                  <th className="py-2 px-2">City/ZIP</th>
                  <th className="py-2 px-2">信仰</th>
                  <th className="py-2 px-2">婚姻</th>
                  <th className="py-2 px-2">介绍人</th>
                  <th className="py-2 px-2">标记</th>
                  <th className="py-2 px-2">活动</th>
                  <th className="py-2 px-2">时间</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium">{r.name}</td>
                    <td className="py-2 px-2">{r.name_en ?? "—"}</td>
                    <td className="py-2 px-2">{r.district ?? "—"}</td>
                    <td className="py-2 px-2">{r.gender ?? "—"}</td>
                    <td className="py-2 px-2">{r.age_group ?? "—"}</td>
                    <td className="py-2 px-2">{r.phone ?? "—"}</td>
                    <td className="py-2 px-2">{r.email ?? "—"}</td>
                    <td className="py-2 px-2">{r.address ?? "—"}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{[r.city, r.zip].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="py-2 px-2">
                      {r.faith === "christian"
                        ? `基督徒${r.faith_years ? ` ${r.faith_years}年` : ""}`
                        : r.faith === "seeker"
                          ? "慕道友"
                          : r.faith === "other"
                            ? `其他${r.faith_other ? `:${r.faith_other}` : ""}`
                            : "—"}
                    </td>
                    <td className="py-2 px-2">
                      {r.marital_status === "married"
                        ? `已婚${r.spouse_name ? `(${r.spouse_name})` : ""}`
                        : r.marital_status === "single"
                          ? "单身"
                          : "—"}
                    </td>
                    <td className="py-2 px-2">
                      {r.referrer_type === "self"
                        ? "自己"
                        : r.referrer_type === "friend"
                          ? `亲友:${r.invited_by ?? ""}`
                          : r.referrer_type === "other"
                            ? `其他:${r.referrer_other ?? ""}`
                            : "—"}
                    </td>
                    <td className="py-2 px-2 space-x-1 whitespace-nowrap">
                      {r.wants_visit && <Tag>欢迎探访</Tag>}
                      {r.wants_info && <Tag tone="accent">需资料</Tag>}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{r.event_id ? eventMap[r.event_id] : "—"}</td>
                    <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 px-2 text-right space-x-3 whitespace-nowrap">
                      <button onClick={() => { setEditForm({ ...r }); setEditOpen(true); }} className="text-xs text-primary hover:underline">编辑</button>
                      <button onClick={() => deleteReg(r.id)} className="text-xs text-destructive hover:underline">删除</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-muted-foreground">
                      暂无登记记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Admin / Users */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">管理员权限</h2>
            <Button size="sm" variant="outline" onClick={loadUsers} disabled={usersLoading}>
              {usersLoading ? "刷新中..." : "刷新"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            管理员可登录后台查看名单、导出 Excel、管理二维码。新注册用户默认为普通用户，需在此授予权限。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground">
                  <th className="py-2 px-2">邮箱</th>
                  <th className="py-2 px-2">角色</th>
                  <th className="py-2 px-2">注册时间</th>
                  <th className="py-2 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isUserAdmin = u.roles.includes("admin");
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">
                        {u.email} {isSelf && <span className="text-xs text-muted-foreground">(我)</span>}
                      </td>
                      <td className="py-2 px-2">
                        {isUserAdmin ? <Tag>管理员</Tag> : <span className="text-muted-foreground text-xs">普通用户</span>}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="py-2 px-2 text-right space-x-3 whitespace-nowrap">
                        {isUserAdmin ? (
                          <button
                            disabled={isSelf}
                            onClick={async () => {
                              if (!confirm(`撤销 ${u.email} 的管理员权限?`)) return;
                              try {
                                await setUserAdminFn({ data: { userId: u.id, makeAdmin: false } });
                                toast.success("已撤销管理员权限");
                                loadUsers();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            撤销管理员
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                await setUserAdminFn({ data: { userId: u.id, makeAdmin: true } });
                                toast.success("已授予管理员权限");
                                loadUsers();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            设为管理员
                          </button>
                        )}
                        <button
                          disabled={isSelf}
                          onClick={async () => {
                            if (!confirm(`确认删除用户 ${u.email}? 此操作不可撤销。`)) return;
                            try {
                              await deleteUserFn({ data: { userId: u.id } });
                              toast.success("用户已删除");
                              loadUsers();
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                          className="text-xs text-destructive hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && !usersLoading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      暂无用户
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑登记</DialogTitle>
            </DialogHeader>
            {editForm && (
              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <Label>区别(选填)</Label>
                  <Input value={editForm.district ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, district: e.target.value } : prev)} placeholder="例如:北区 / 团契名称" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>姓名(中文) <span className="text-destructive">*</span></Label>
                    <Input value={editForm.name} onChange={(e) => setEditForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                  </div>
                  <div className="space-y-2">
                    <Label>姓名(英文)</Label>
                    <Input value={editForm.name_en ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, name_en: e.target.value } : prev)} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>性别</Label>
                    <RadioGroup value={editForm.gender ?? ""} onValueChange={(v) => setEditForm((prev) => prev ? { ...prev, gender: v } : prev)} className="flex gap-4 pt-2">
                      {["男", "女"].map((g) => (
                        <label key={g} className="flex items-center gap-2 cursor-pointer">
                          <RadioGroupItem value={g} /> <span className="text-sm">{g}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label>年龄段</Label>
                    <RadioGroup value={editForm.age_group ?? ""} onValueChange={(v) => setEditForm((prev) => prev ? { ...prev, age_group: v } : prev)} className="flex flex-wrap gap-3 pt-2">
                      {["60岁以上", "40-60岁", "20-39岁"].map((a) => (
                        <label key={a} className="flex items-center gap-2 cursor-pointer">
                          <RadioGroupItem value={a} /> <span className="text-sm">{a}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>地址</Label>
                  <Input value={editForm.address ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, address: e.target.value } : prev)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>City</Label>
                    <Input value={editForm.city ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, city: e.target.value } : prev)} />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP</Label>
                    <Input value={editForm.zip ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, zip: e.target.value } : prev)} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>电话</Label>
                    <Input type="tel" value={editForm.phone ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)} />
                  </div>
                  <div className="space-y-2">
                    <Label>电邮地址</Label>
                    <Input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, email: e.target.value } : prev)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>信仰</Label>
                  <RadioGroup value={editForm.faith ?? ""} onValueChange={(v) => setEditForm((prev) => prev ? { ...prev, faith: v } : prev)} className="flex flex-wrap gap-4 pt-2">
                    {[
                      { v: "christian", l: "基督徒" },
                      { v: "seeker", l: "慕道友" },
                      { v: "other", l: "其他" },
                    ].map((o) => (
                      <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {editForm.faith === "christian" && (
                    <div className="pt-3 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">信主</span>
                      <Input type="number" min={0} value={editForm.faith_years ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, faith_years: e.target.value ? Number(e.target.value) : null } : prev)} className="w-24" />
                      <span className="text-sm text-muted-foreground">年</span>
                    </div>
                  )}
                  {editForm.faith === "other" && (
                    <Input className="mt-3" placeholder="请说明" value={editForm.faith_other ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, faith_other: e.target.value } : prev)} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>婚姻</Label>
                  <RadioGroup value={editForm.marital_status ?? ""} onValueChange={(v) => setEditForm((prev) => prev ? { ...prev, marital_status: v } : prev)} className="flex flex-wrap gap-4 pt-2">
                    {[
                      { v: "married", l: "已婚" },
                      { v: "single", l: "单身" },
                    ].map((o) => (
                      <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {editForm.marital_status === "married" && (
                    <Input className="mt-3" placeholder="配偶姓名" value={editForm.spouse_name ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, spouse_name: e.target.value } : prev)} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>介绍人</Label>
                  <RadioGroup value={editForm.referrer_type ?? ""} onValueChange={(v) => setEditForm((prev) => prev ? { ...prev, referrer_type: v } : prev)} className="flex flex-wrap gap-4 pt-2">
                    {[
                      { v: "self", l: "自己" },
                      { v: "friend", l: "亲友" },
                      { v: "other", l: "其他" },
                    ].map((o) => (
                      <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {editForm.referrer_type === "friend" && (
                    <Input className="mt-3" placeholder="亲友姓名" value={editForm.invited_by ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, invited_by: e.target.value } : prev)} />
                  )}
                  {editForm.referrer_type === "other" && (
                    <Input className="mt-3" placeholder="请说明" value={editForm.referrer_other ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, referrer_other: e.target.value } : prev)} />
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-border/50">
                  <label className="flex items-center gap-3 cursor-pointer pt-3">
                    <Checkbox checked={editForm.wants_visit ?? false} onCheckedChange={(v) => setEditForm((prev) => prev ? { ...prev, wants_visit: !!v } : prev)} />
                    <span className="text-sm">我欢迎教会牧者探访我</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={editForm.wants_info ?? false} onCheckedChange={(v) => setEditForm((prev) => prev ? { ...prev, wants_info: !!v } : prev)} />
                    <span className="text-sm">我需要教会的资料及联络</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label>备注 / 代祷事项(选填)</Label>
                  <Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)} rows={3} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
              <Button onClick={saveEdit}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5">
      <div className="text-3xl font-serif text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Tag({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "accent" }) {
  const cls = tone === "accent"
    ? "bg-accent/30 text-accent-foreground"
    : "bg-primary/15 text-primary";
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}