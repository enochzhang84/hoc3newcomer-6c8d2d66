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
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [regs, setRegs] = useState<Reg[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [dateFilterMode, setDateFilterMode] = useState<"day" | "after" | "before">("day");
  const [dateOpen, setDateOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [messagesCount, setMessagesCount] = useState(0);

  const fetchUsersFn = useServerFn(listUsersWithRoles);
  const setUserAdminFn = useServerFn(setUserAdmin);
  const deleteUserFn = useServerFn(deleteUser);
  const updateRegFn = useServerFn(updateRegistration);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Reg | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [logs, setLogs] = useState<{ time: string; actor: string; action: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "未联系" | "已联系">("all");

  const LOG_KEY = "admin_action_logs";
  const loadLogs = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      setLogs(raw ? JSON.parse(raw) : []);
    } catch {
      setLogs([]);
    }
  }, []);
  const logAction = useCallback((action: string) => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const arr: { time: string; actor: string; action: string }[] = raw ? JSON.parse(raw) : [];
      arr.unshift({ time: new Date().toISOString(), actor: currentUserEmail || "管理员", action });
      // cap at 500 entries
      localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(0, 500)));
    } catch {
      // ignore
    }
  }, [currentUserEmail]);

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

  const loadMessagesCount = useCallback(async () => {
    const lastSeen = Number(localStorage.getItem("messages_last_seen") ?? 0);
    const { data } = await supabase
      .from("messages")
      .select("updated_at");
    const unread = (data ?? []).filter(
      (m) => new Date(m.updated_at).getTime() > lastSeen,
    ).length;
    setMessagesCount(unread);
  }, []);

  const markMessagesSeen = useCallback(() => {
    localStorage.setItem("messages_last_seen", String(Date.now()));
    setMessagesCount(0);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/login" });
        return;
      }
      setCurrentUserId(session.session.user.id);
      setCurrentUserEmail(session.session.user.email ?? "");
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
        loadMessagesCount();
      }
    })();
  }, [navigate, loadData, loadUsers, loadMessagesCount]);

  // Realtime update of message count badge
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("messages-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadMessagesCount();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin, loadMessagesCount]);

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
    const status = r.district === "已联系" ? "已联系" : "未联系";
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    if (!filterDate) return matchesSearch && matchesStatus;
    // Compare in browser local timezone (e.g. America/Los_Angeles)
    const d = new Date(r.created_at);
    const start = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 0, 0, 0, 0);
    const end = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate() + 1, 0, 0, 0, 0);
    const matchesDate =
      dateFilterMode === "day" ? d >= start && d < end :
      dateFilterMode === "after" ? d >= end :
      d < start;
    return matchesSearch && matchesDate && matchesStatus;
  });

  function buildExcelRows(list: Reg[]) {
    return list.map((r) => ({
      姓名中: r.name,
      姓名英: r.name_en ?? "",
      跟进状态: r.district === "已联系" ? "已联系" : "未联系",
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
  }

  function exportRows(list: Reg[], filenamePrefix: string) {
    const rows = buildExcelRows(list);
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "新人登记");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filenamePrefix}_${date}.xlsx`);
    toast.success(`已导出 ${rows.length} 条记录`);
  }

  function exportExcel() {
    exportRows(filtered, "新人登记");
  }

  function exportAllExcel() {
    exportRows(regs, "新人登记_全部");
  }

  async function addEvent() {
    const { error } = await supabase.from("events").insert({ name: "新人登记" });
    if (error) toast.error(error.message);
    else {
      loadData();
      logAction("生成了新二维码");
      toast.success("新二维码已生成");
    }
  }

  async function deleteReg(id: string) {
    if (!confirm("确认删除此登记?")) return;
    const target = regs.find((r) => r.id === id);
    const { error } = await supabase.from("registrations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setRegs((prev) => prev.filter((r) => r.id !== id));
      logAction(`删除了登记 ${target?.name ?? id}`);
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
      logAction(`编辑了资料 ${editForm.name.trim()}`);
      toast.success("已保存");
      loadData();
    } catch (e) {
      toast.error("保存失败:" + (e as Error).message);
    }
  }

  async function updateStatus(r: Reg, status: "未联系" | "已联系") {
    const prev = r.district;
    setRegs((list) => list.map((x) => (x.id === r.id ? { ...x, district: status } : x)));
    try {
      await updateRegFn({
        data: {
          id: r.id,
          name: r.name,
          name_en: r.name_en ?? null,
          district: status,
          gender: r.gender ?? null,
          age_group: r.age_group ?? null,
          address: r.address ?? null,
          city: r.city ?? null,
          zip: r.zip ?? null,
          phone: r.phone ?? null,
          email: r.email ?? null,
          faith: r.faith ?? null,
          faith_years: r.faith_years ?? null,
          faith_other: r.faith_other ?? null,
          marital_status: r.marital_status ?? null,
          spouse_name: r.spouse_name ?? null,
          referrer_type: r.referrer_type ?? null,
          invited_by: r.invited_by ?? null,
          referrer_other: r.referrer_other ?? null,
          wants_visit: r.wants_visit ?? false,
          wants_info: r.wants_info ?? false,
          notes: r.notes ?? null,
        },
      });
      logAction(`更新了 ${r.name} 跟进状态: ${status}`);
    } catch (e) {
      setRegs((list) => list.map((x) => (x.id === r.id ? { ...x, district: prev } : x)));
      toast.error("更新失败:" + (e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-xl">基督之家第三家 · 后台</Link>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://hoc3.org/wp2021/home/", "_blank", "noopener,noreferrer")}
            >
              基督三家主页
            </Button>
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
        <section>
          <h2 className="font-serif text-xl mb-4">数据统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="总登记数" value={regs.length} />
          <Stat label="希望探访" value={regs.filter((r) => r.wants_visit).length} />
          <Stat label="需要资料" value={regs.filter((r) => r.wants_info).length} />
          <Stat label="活动数" value={events.length} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
            {(() => {
              const thisWeek = countSince(regs, startOfWeek());
              const lastWeek = countBetween(regs, prevStartOfWeek(), startOfWeek());
              const thisMonth = countSince(regs, startOfMonth());
              const lastMonth = countBetween(regs, prevStartOfMonth(), startOfMonth());
              const weekRegs = regs.filter((r) => new Date(r.created_at) >= startOfWeek());
              const monthRegs = regs.filter((r) => new Date(r.created_at) >= startOfMonth());
              return (
                <>
                  <StatBreakdown
                    label="本周登记"
                    total={thisWeek + lastWeek}
                    items={[
                      { key: "本周", count: thisWeek },
                      { key: "上周", count: lastWeek },
                    ]}
                    trend={thisWeek - lastWeek}
                    chart
                    genderSubset={weekRegs}
                  />
                  <StatBreakdown
                    label="本月登记"
                    total={thisMonth + lastMonth}
                    items={[
                      { key: "本月", count: thisMonth },
                      { key: "上月", count: lastMonth },
                    ]}
                    trend={thisMonth - lastMonth}
                    chart
                    genderSubset={monthRegs}
                  />
                </>
              );
            })()}
            <StatBreakdown
              label="性别"
              total={regs.length}
              items={groupCounts(regs, (r) =>
                r.gender === "男" || r.gender === "male" ? "男" :
                r.gender === "女" || r.gender === "female" ? "女" : "未填"
              )}
              chart
              genderSubset={regs}
            />
            <StatBreakdown
              label="年龄"
              total={regs.length}
              items={groupCounts(regs, (r) => r.age_group ?? "未填")}
              chart
              genderSubset={regs}
            />
            <StatBreakdown
              label="信仰"
              total={regs.length}
              items={groupCounts(regs, (r) =>
                r.faith === "christian" ? "基督徒" :
                r.faith === "seeker" ? "慕道友" :
                r.faith === "other" ? "其他" : "未填"
              )}
              chart
              genderSubset={regs}
            />
            <StatBreakdown
              label="邀请人"
              total={regs.filter((r) => r.referrer_type === "friend" && r.invited_by?.trim()).length}
              items={groupCounts(
                regs.filter((r) => r.referrer_type === "friend" && r.invited_by?.trim()),
                (r) => r.invited_by!.trim()
              )}
              rank
            />
          </div>
        </section>

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

        {/* Media / Projection */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-xl mb-4">影音投影</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-border/50 rounded-xl p-4 flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">今日登记名单(适合投影)</p>
              <Button
                variant="outline"
                onClick={() => window.open("/today-preview", "_blank")}
              >
                今日登记名单
              </Button>
            </div>
            <div
              onDoubleClick={() => {
                markMessagesSeen();
                window.open("/message-board", "_blank");
              }}
              title="双击打开留言板"
              className="relative border border-border/50 rounded-xl p-4 flex flex-col items-start gap-3 cursor-pointer hover:border-primary/60 transition-colors select-none"
            >
              {messagesCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center shadow-md ring-2 ring-background"
                  title={`${messagesCount} 条留言`}
                >
                  {messagesCount > 99 ? "99+" : messagesCount}
                </span>
              )}
              <p className="text-sm text-muted-foreground">留言板(双击打开新页面编辑)</p>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  markMessagesSeen();
                  window.open("/message-board", "_blank");
                }}
              >
                打开留言板
              </Button>
            </div>
          </div>
        </section>

        {/* Registrations */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-xl">登记名单</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={filterDate ? "outline" : "default"}
                size="sm"
                onClick={() => setFilterDate(undefined)}
              >
                全部名单
              </Button>
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
              <Button onClick={exportExcel} disabled={filtered.length === 0}>
                导出 Excel
              </Button>
              <Button onClick={exportAllExcel} disabled={regs.length === 0} variant="outline">
                导出全部 Excel
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground">
                  <th className="py-2 px-2">时间</th>
                  <th className="py-2 px-2">姓名(中)</th>
                  <th className="py-2 px-2">姓名(英)</th>
                  <th className="py-2 px-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as "all" | "未联系" | "已联系")}
                      className="bg-transparent border border-border/60 rounded px-1 py-0.5 text-xs cursor-pointer"
                      title="跟进状态筛选"
                    >
                      <option value="all">跟进状态 ▾</option>
                      <option value="未联系">未联系</option>
                      <option value="已联系">已联系</option>
                    </select>
                  </th>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 px-2 font-medium">{r.name}</td>
                    <td className="py-2 px-2">{r.name_en ?? "—"}</td>
                    <td className="py-2 px-2">
                      <select
                        value={r.district === "已联系" ? "已联系" : "未联系"}
                        onChange={(e) => updateStatus(r, e.target.value as "未联系" | "已联系")}
                        className={`bg-transparent border border-border/60 rounded px-1 py-0.5 text-xs cursor-pointer ${r.district === "已联系" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <option value="未联系">未联系 ▾</option>
                        <option value="已联系">已联系</option>
                      </select>
                    </td>
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
                                logAction(`撤销了 ${u.email} 的管理员权限`);
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
                                logAction(`授予了 ${u.email} 管理员权限`);
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
                              logAction(`删除了用户 ${u.email}`);
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

        {/* System Tools */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">系统工具栏</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            管理员可用的系统级工具。日志记录管理员在本浏览器上的操作（编辑、删除、权限变更等）。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => { loadLogs(); setLogsOpen(true); }}
            >
              操作日志
            </Button>
            <Button
              variant="destructive"
              onClick={() => setInitOpen(true)}
            >
              系统初始化
            </Button>
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
                  <Label>跟进状态</Label>
                  <select
                    value={editForm.district === "已联系" ? "已联系" : "未联系"}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, district: e.target.value } : prev)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="未联系">未联系</option>
                    <option value="已联系">已联系</option>
                  </select>
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

        {/* Logs Dialog */}
        <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>操作日志</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">暂无日志</p>
              ) : (
                logs.map((l, i) => {
                  const d = new Date(l.time);
                  const md = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  return (
                    <div key={i} className="flex gap-3 py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">{md} {hm}</span>
                      <span className="font-medium whitespace-nowrap">{l.actor}</span>
                      <span className="text-foreground/80">{l.action}</span>
                    </div>
                  );
                })
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (!confirm("确认清空所有日志?")) return;
                  localStorage.removeItem(LOG_KEY);
                  setLogs([]);
                  toast.success("日志已清空");
                }}
              >
                清空日志
              </Button>
              <Button onClick={() => setLogsOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* System Init Dialog */}
        <Dialog open={initOpen} onOpenChange={(o) => { if (!initLoading) setInitOpen(o); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>系统初始化</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm">
              <p className="text-destructive font-medium">
                初始化前请先导出录用名单！
              </p>
              <p className="text-muted-foreground">
                此操作将清空所有新人登记记录，并把系统更新为全新状态。该操作不可撤销。
              </p>
              <p className="text-muted-foreground">
                当前共有 <span className="font-semibold text-foreground">{regs.length}</span> 条登记记录。
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                disabled={initLoading}
                onClick={() => exportAllExcel()}
              >
                导出全部名单 Excel
              </Button>
              <Button
                variant="destructive"
                disabled={initLoading}
                onClick={async () => {
                  setInitLoading(true);
                  const { error } = await supabase
                    .from("registrations")
                    .delete()
                    .not("id", "is", null);
                  if (error) {
                    setInitLoading(false);
                    toast.error("初始化失败: " + error.message);
                    return;
                  }
                  const { error: evErr } = await supabase
                    .from("events")
                    .delete()
                    .not("id", "is", null);
                  setInitLoading(false);
                  if (evErr) {
                    toast.error("清空活动失败: " + evErr.message);
                    return;
                  }
                  logAction(`系统初始化（清空了 ${regs.length} 条登记）`);
                  toast.success("系统已初始化");
                  setInitOpen(false);
                  loadData();
                }}
              >
                {initLoading ? "正在初始化..." : "确定初始化"}
              </Button>
              <Button
                variant="secondary"
                disabled={initLoading}
                onClick={() => setInitOpen(false)}
              >
                取消初始化
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 h-full flex flex-col justify-center">
      <div className="text-3xl font-serif text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function StatBreakdown({
  label,
  total,
  items,
  trend,
  chart,
  rank,
  genderSubset,
}: {
  label: string;
  total: number;
  items?: { key: string; count: number }[];
  trend?: number;
  chart?: boolean;
  rank?: boolean;
  genderSubset?: Reg[];
}) {
  const max = items && items.length > 0 ? Math.max(...items.map((i) => i.count), 1) : 1;
  const medals = ["🥇", "🥈", "🥉"];
  const male = genderSubset ? genderSubset.filter((r) => r.gender === "男" || r.gender === "male").length : 0;
  const female = genderSubset ? genderSubset.filter((r) => r.gender === "女" || r.gender === "female").length : 0;
  const gTotal = male + female;
  const malePct = gTotal > 0 ? Math.round((male / gTotal) * 100) : 0;
  const femalePct = gTotal > 0 ? 100 - malePct : 0;
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 h-full flex flex-col">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="text-2xl font-serif text-foreground">{total}</div>
        {typeof trend === "number" && (
          <span
            className={`text-xs tabular-nums ${
              trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"
            }`}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {trend > 0 ? "+" : ""}{trend}
          </span>
        )}
      </div>
      {items && items.length > 0 && (
        <div className="flex-1 min-h-0 mt-3 overflow-y-auto">
          {rank ? (
            <div className="space-y-1">
              {items.slice(0, 5).map((it, idx) => (
                <div key={it.key} className="flex items-center gap-2 text-sm">
                  <span className="text-base">{medals[idx] || `${idx + 1}.`}</span>
                  <span className="truncate text-foreground">{it.key}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{it.count}人</span>
                </div>
              ))}
            </div>
          ) : chart ? (
            <div className="space-y-1.5">
              {items.map((it) => (
                <div key={it.key} className="text-xs">
                  <div className="flex justify-between text-muted-foreground mb-0.5">
                    <span className="truncate pr-2">{it.key}</span>
                    <span className="text-foreground tabular-nums">
                      {it.count}
                      {total > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({Math.round((it.count / total) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(it.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {items.map((it) => (
                <div key={it.key} className="flex justify-between text-xs text-muted-foreground">
                  <span className="truncate pr-2">{it.key}</span>
                  <span className="text-foreground tabular-nums">{it.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {genderSubset && (
        <div className="mt-3 pt-3 border-t border-border/40 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">男 / 女</span>
            <span className="text-foreground tabular-nums">{male} / {female}</span>
          </div>
          {gTotal > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
              <div className="bg-sky-500" style={{ width: `${malePct}%` }} />
              <div className="bg-pink-500" style={{ width: `${femalePct}%` }} />
            </div>
          )}
          <div className="flex justify-between text-muted-foreground tabular-nums">
            <span>{malePct}%</span>
            <span>{femalePct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday as week start
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff, 0, 0, 0, 0);
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function prevStartOfWeek() {
  const s = startOfWeek();
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7, 0, 0, 0, 0);
}

function prevStartOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
}

function countSince(list: Reg[], since: Date) {
  return list.filter((r) => new Date(r.created_at) >= since).length;
}

function countBetween(list: Reg[], from: Date, to: Date) {
  return list.filter((r) => {
    const t = new Date(r.created_at);
    return t >= from && t < to;
  }).length;
}

function groupCounts(list: Reg[], keyFn: (r: Reg) => string) {
  const map = new Map<string, number>();
  for (const r of list) {
    const k = keyFn(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function Tag({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "accent" }) {
  const cls = tone === "accent"
    ? "bg-accent/30 text-accent-foreground"
    : "bg-primary/15 text-primary";
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}