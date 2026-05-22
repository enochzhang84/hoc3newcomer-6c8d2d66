import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listUsersWithRoles, setUserAdmin, deleteUser } from "@/lib/users.functions";

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
  const [origin, setOrigin] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const fetchUsersFn = useServerFn(listUsersWithRoles);
  const setUserAdminFn = useServerFn(setUserAdmin);
  const deleteUserFn = useServerFn(deleteUser);

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
  const filtered = regs.filter(
    (r) =>
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone ?? "").includes(search),
  );

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
            <div className="flex gap-2">
              <Input
                placeholder="搜索姓名或电话"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
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
                    <td className="py-2 px-2 text-right">
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