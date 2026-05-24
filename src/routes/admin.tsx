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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { listUsersWithRoles, setUserRole, deleteUser } from "@/lib/users.functions";
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
  follow_up_person: string | null;
};

type Event = { id: string; name: string; qr_token: string; is_active: boolean };

function formatReferrer(r: Pick<Reg, "referrer_type" | "invited_by" | "referrer_other">): string {
  switch (r.referrer_type) {
    case "self": return "自己";
    case "friend": return `亲友:${r.invited_by ?? ""}`;
    case "wechat": return "微信/小红书";
    case "youtube": return "YouTube";
    case "missionary": return `宣教士:${r.invited_by ?? ""}`;
    case "other": return `其他:${r.referrer_other ?? ""}`;
    default: return "";
  }
}

type AppUser = { id: string; email: string; created_at: string; roles: string[] };

type ServiceApp = {
  id: string;
  name: string;
  gender: string | null;
  phone: string | null;
  wechat: string | null;
  service_project: string;
  notes: string | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  record_date: string;
  worship_count: number;
  children_students: number;
  children_teachers: number;
  notes: string | null;
  created_at: string;
};

type Feedback = {
  id: string;
  name: string;
  contact: string;
  fellowship: string | null;
  title: string;
  description: string | null;
  images: string[];
  created_at: string;
};

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRoleState] = useState<"admin" | "user" | "viewer" | null>(null);
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
  const [pendingRoleSelections, setPendingRoleSelections] = useState<Record<string, "admin" | "user" | "viewer">>({});
  const [messagesCount, setMessagesCount] = useState(0);
  const [serviceApps, setServiceApps] = useState<ServiceApp[]>([]);
  const [serviceListOpen, setServiceListOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackListOpen, setFeedbackListOpen] = useState(false);
  const [feedbackDetail, setFeedbackDetail] = useState<Feedback | null>(null);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [attDate, setAttDate] = useState<string>(todayStr);
  const [attWorship, setAttWorship] = useState<string>("");
  const [attStudents, setAttStudents] = useState<string>("");
  const [attTeachers, setAttTeachers] = useState<string>("");
  const [attText, setAttText] = useState<string>("");
  const [attTextRecords, setAttTextRecords] = useState<
    { id: string; date: string; text: string; savedAt: string }[]
  >([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("attendance_text_records");
      if (raw) setAttTextRecords(JSON.parse(raw));
    } catch {}
  }, []);
  const persistAttTextRecords = (
    next: { id: string; date: string; text: string; savedAt: string }[],
  ) => {
    setAttTextRecords(next);
    try {
      localStorage.setItem("attendance_text_records", JSON.stringify(next));
    } catch {}
  };

  const fetchUsersFn = useServerFn(listUsersWithRoles);
  const setUserRoleFn = useServerFn(setUserRole);
  const deleteUserFn = useServerFn(deleteUser);
  const updateRegFn = useServerFn(updateRegistration);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Reg | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [logs, setLogs] = useState<{ time: string; actor: string; action: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "未联系" | "已联系">("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

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
    const [{ data: r }, { data: e }, { data: s }, { data: a }, { data: f }] = await Promise.all([
      supabase.from("registrations").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("created_at", { ascending: true }),
      supabase.from("service_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("attendance_records").select("*").order("record_date", { ascending: false }),
      supabase.from("feedbacks").select("*").order("created_at", { ascending: false }),
    ]);
    setRegs(r ?? []);
    setEvents(e ?? []);
    setServiceApps((s ?? []) as ServiceApp[]);
    setAttendance((a ?? []) as AttendanceRecord[]);
    setFeedbacks((f ?? []) as Feedback[]);
  }, []);

  const loadMessagesCount = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;
    const { data: pref } = await supabase
      .from("user_preferences")
      .select("last_messages_seen_at")
      .eq("user_id", uid)
      .maybeSingle();
    const lastSeen = pref?.last_messages_seen_at
      ? new Date(pref.last_messages_seen_at).getTime()
      : 0;
    const { data } = await supabase.from("messages").select("updated_at");
    const unread = (data ?? []).filter(
      (m) => new Date(m.updated_at).getTime() > lastSeen,
    ).length;
    setMessagesCount(unread);
  }, []);

  const markMessagesSeen = useCallback(async () => {
    setMessagesCount(0);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;
    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: uid, last_messages_seen_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let initializing = false;
    let resolved = false;
    const handleSession = (sess: { user: { id: string; email?: string | null } } | null) => {
      if (cancelled) return;
      if (resolved && sess) {
        // already handled; only react to sign-out below
        return;
      }
      resolved = true;
      if (!sess) {
        navigate({ to: "/login" });
        return;
      }
      if (initializing) return;
      initializing = true;
      setCurrentUserId(sess.user.id);
      setCurrentUserEmail(sess.user.email ?? "");
      void (async () => {
        try {
          const { data: roles, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", sess.user.id);
          if (cancelled) return;
          if (error) throw error;
          const admin = roles?.some((r) => r.role === "admin") ?? false;
          const isUser = roles?.some((r) => r.role === "user") ?? false;
          const isViewer = roles?.some((r) => r.role === "viewer") ?? false;
          const role: "admin" | "user" | "viewer" | null =
            admin ? "admin" : isUser ? "user" : isViewer ? "viewer" : null;
          setIsAdmin(admin);
          setUserRoleState(role);
          setChecking(false);
          if (role) {
            void loadData();
            void loadMessagesCount();
            void loadUsers();
          }
        } catch (e) {
          if (!cancelled) {
            toast.error("后台权限加载失败，请刷新后重试");
            setChecking(false);
          }
        } finally {
          initializing = false;
        }
      })();
    };

    // Listen first — INITIAL_SESSION fires reliably even when getSession()
    // hangs on the Web Locks API (mobile Chrome standard mode with cached session).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        handleSession(session ? { user: session.user } : null);
      } else if (event === "SIGNED_OUT") {
        resolved = false;
        handleSession(null);
      }
    });

    // Fallback: race getSession against a timeout so we never block forever.
    void (async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (cancelled || resolved) return;
        if (result && "data" in result) {
          handleSession(result.data.session ? { user: result.data.session.user } : null);
        }
        // If timed out and still not resolved (Web Locks stuck on iOS Chrome
        // with a cached session), clear stale supabase auth storage and
        // redirect to login so the user can sign in again.
        if (!result) {
          setTimeout(() => {
            if (cancelled || resolved) return;
            try {
              Object.keys(localStorage)
                .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
                .forEach((k) => localStorage.removeItem(k));
            } catch {
              // ignore
            }
            resolved = true;
            setChecking(false);
            toast.error("登录状态已过期，请重新登录");
            navigate({ to: "/login" });
          }, 2000);
        }
      } catch {
        if (!cancelled && !resolved) {
          setChecking(false);
          toast.error("登录状态加载超时，请刷新页面重试");
        }
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, loadData, loadUsers, loadMessagesCount]);

  // Realtime update of message count badge
  useEffect(() => {
    const ch = supabase
      .channel("messages-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadMessagesCount();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadMessagesCount]);

  // Realtime auto-update of new registrations
  useEffect(() => {
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
  }, []);

  // Realtime new feedback notifications
  useEffect(() => {
    const ch = supabase
      .channel("feedbacks-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feedbacks" }, (payload) => {
        setFeedbacks((prev) => [payload.new as Feedback, ...prev]);
        toast.success(`新问题反馈:${(payload.new as Feedback).name}`);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterDate, statusFilter, dateFilterMode]);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中...</div>;
  if (!userRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">您的账号尚未审核，请联系管理员授权</p>
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      城市: r.city ?? "",
      邮编: r.zip ?? "",
      信仰: r.faith === "christian" ? "基督徒" : r.faith === "seeker" ? "慕道友" : r.faith === "other" ? `其他:${r.faith_other ?? ""}` : "",
      信主年数: r.faith_years ?? "",
      婚姻: r.marital_status === "married" ? "已婚" : r.marital_status === "single" ? "单身" : "",
      配偶: r.spouse_name ?? "",
      来到方式: formatReferrer(r),
      欢迎探访: r.wants_visit ? "是" : "否",
      需要资料: r.wants_info ? "是" : "否",
      备注: r.notes ?? "",
      来源: r.source === "qr" ? "扫码" : "手动",
      跟进人: r.follow_up_person ?? "",
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

  function printHandwrittenForms(list: Reg[]) {
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const faithText = (r: Reg) => {
      if (r.faith === "christian") return `☑基督徒 年${r.faith_years ?? ""}　☐慕道友　☐其他`;
      if (r.faith === "seeker") return `☐基督徒 年___　☑慕道友　☐其他`;
      if (r.faith === "other") return `☐基督徒 年___　☐慕道友　☑其他 ${esc(r.faith_other ?? "")}`;
      return `☐基督徒 年___　☐慕道友　☐其他`;
    };
    const ageText = (r: Reg) => {
      const a = r.age_group ?? "";
      const m = (v: string) => (a === v ? "☑" : "☐");
      return `${m("60+")}60歲以上　${m("40-60")}40-60歲　${m("20-39")}20-39歲`;
    };
    const genderText = (r: Reg) => {
      const g = r.gender ?? "";
      return `${g === "male" ? "☑" : "☐"}男　${g === "female" ? "☑" : "☐"}女`;
    };
    const maritalText = (r: Reg) => {
      const m = r.marital_status ?? "";
      return `${m === "married" ? "☑" : "☐"}已婚　配偶姓名：${esc(r.spouse_name ?? "")}　${m === "single" ? "☑" : "☐"}單身`;
    };
    const referrerText = (r: Reg) => {
      const t = r.referrer_type ?? "";
      const friendName = t === "friend" ? esc(r.invited_by ?? "") : "";
      const missionaryName = t === "missionary" ? esc(r.invited_by ?? "") : "";
      const otherText = t === "other" ? esc(r.referrer_other ?? "") : "";
      return `${t === "self" ? "☑" : "☐"}自己　${t === "friend" ? "☑" : "☐"}親友姓名 ${friendName}　${t === "wechat" ? "☑" : "☐"}微信/小紅書　${t === "youtube" ? "☑" : "☐"}YouTube　${t === "missionary" ? "☑" : "☐"}宣教士 ${missionaryName}　${t === "other" ? "☑" : "☐"}其他 ${otherText}`;
    };
    const wantsText = (r: Reg) =>
      `${r.wants_visit ? "☑" : "☐"}我歡迎教會牧者探訪我　${r.wants_info ? "☑" : "☐"}我需要教會的資料及聯絡`;

    const renderForm = (r: Reg) => {
      const date = new Date(r.created_at).toLocaleDateString("zh-CN");
      return `
        <div class="form">
          <h2>基督之家第三家新人資料表</h2>
          <div class="row"><span class="lbl">日期：</span><span class="val">${esc(date)}</span><span class="lbl right">區別：</span><span class="val short">${esc(r.district ?? "")}</span></div>
          <div class="row"><span class="lbl">姓名：(中)</span><span class="val">${esc(r.name)}</span><span class="lbl">(英)</span><span class="val">${esc(r.name_en ?? "")}</span><span class="lbl right">性別：${genderText(r)}</span></div>
          <div class="row"><span class="lbl">地址：</span><span class="val grow">${esc(r.address ?? "")}</span></div>
          <div class="row"><span class="lbl">City：</span><span class="val">${esc(r.city ?? "")}</span><span class="lbl">ZIP：</span><span class="val">${esc(r.zip ?? "")}</span></div>
          <div class="row"><span class="lbl">電話：</span><span class="val">${esc(r.phone ?? "")}</span><span class="lbl">電郵地址：</span><span class="val grow">${esc(r.email ?? "")}</span></div>
          <div class="row"><span class="lbl">信仰：</span><span class="val grow">${faithText(r)}</span></div>
          <div class="row"><span class="lbl">年齡：</span><span class="val grow">${ageText(r)}</span></div>
          <div class="row"><span class="lbl">婚姻：</span><span class="val grow">${maritalText(r)}</span></div>
          <div class="row"><span class="lbl">介紹人：</span><span class="val grow">${referrerText(r)}</span></div>
          <div class="row"><span class="val grow">${wantsText(r)}</span></div>
          ${r.notes ? `<div class="row"><span class="lbl">備註：</span><span class="val grow">${esc(r.notes)}</span></div>` : ""}
        </div>
      `;
    };

    // Group into pages of 4
    const pages: Reg[][] = [];
    for (let i = 0; i < list.length; i += 4) pages.push(list.slice(i, i + 4));

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>新人資料表 打印</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "PingFang SC", "Songti SC", serif; margin: 0; color: #000; }
  .page { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3mm; width: 281mm; height: 194mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .form { border: 1px solid #000; padding: 3mm 4mm; font-size: 9pt; line-height: 1.35; display: flex; flex-direction: column; gap: 1.2mm; overflow: hidden; }
  .form h2 { text-align: center; margin: 0 0 1mm; font-size: 11pt; font-weight: 700; letter-spacing: 1.5px; }
  .row { display: flex; align-items: baseline; gap: 2mm; border-bottom: 1px dotted #888; padding-bottom: 0.8mm; min-height: 5mm; flex-wrap: nowrap; }
  .lbl { white-space: nowrap; font-weight: 500; }
  .lbl.right { margin-left: auto; }
  .val { min-width: 20mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .val.short { min-width: 12mm; }
  .val.grow { flex: 1; min-width: 0; }
  .toolbar { padding: 10px; display: flex; gap: 8px; justify-content: center; background: #f5f5f5; }
  .toolbar button { padding: 8px 16px; font-size: 14px; cursor: pointer; }
  @media print { .toolbar { display: none; } }
</style></head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">打印</button>
    <button onclick="window.close()">关闭</button>
  </div>
  ${pages
    .map(
      (p) => `<div class="page">${p.map(renderForm).join("")}${Array.from({ length: 4 - p.length }).map(() => '<div class="form" style="border:1px dashed #ccc;"></div>').join("")}</div>`,
    )
    .join("")}
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("浏览器拦截了弹窗，请允许弹出窗口");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
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
          invited_by: (editForm.referrer_type === "friend" || editForm.referrer_type === "missionary") ? editForm.invited_by?.trim() || null : null,
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
          <Link to="/" className="font-serif text-xl flex items-baseline gap-3">
            <span>基督之家第三家 控制面板</span>
            <NowLabel />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://hoc3.org/wp2021/home/", "_blank", "noopener,noreferrer")}
            >
              基督三家主页
            </Button>
            {isAdmin && (
              <Link to="/register" target="_blank">
                <Button size="sm">手动录入</Button>
              </Link>
            )}
            {!isAdmin && (
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
                只读模式（{userRole === "user" ? "一般用户" : "访客"}）
              </span>
            )}
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
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 h-auto w-full mb-6">
            <TabsTrigger value="stats">数据统计</TabsTrigger>
            <TabsTrigger value="welcome">迎宾接待</TabsTrigger>
            <TabsTrigger value="media">影音播放</TabsTrigger>
            <TabsTrigger value="kitchen">厨房侍工</TabsTrigger>
            <TabsTrigger value="sunday">主日学</TabsTrigger>
            <TabsTrigger value="events">活动</TabsTrigger>
          </TabsList>

          <fieldset disabled={!isAdmin} className="contents">

            <TabsContent value="stats" className="space-y-8 mt-0">
        <section>
          <h2 className="font-serif text-xl mb-4">数据统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="总登记数" value={regs.length} />
          <Stat label="希望探访" value={regs.filter((r) => r.wants_visit).length} />
          <Stat label="需要资料" value={regs.filter((r) => r.wants_info).length} />
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
            <StatBreakdown
              label="跟进状态"
              total={regs.length}
              items={[
                { key: "已跟进", count: regs.filter((r) => r.follow_up_person?.trim()).length },
                { key: "未跟进", count: regs.filter((r) => !r.follow_up_person?.trim()).length },
              ]}
              chart
            />
            <StatBreakdown
              label="跟进人排行"
              total={regs.filter((r) => r.follow_up_person?.trim()).length}
              items={groupCounts(
                regs.filter((r) => r.follow_up_person?.trim()),
                (r) => r.follow_up_person!.trim()
              )}
              rank
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => window.open("/data-preview", "_blank", "noopener,noreferrer")}
            >
              导出数据
            </Button>
          </div>
        </section>
            </TabsContent>

            <TabsContent value="welcome" className="space-y-8 mt-0">
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
              <Button
                onClick={() => printHandwrittenForms(filtered)}
                disabled={filtered.length === 0}
                variant="outline"
              >
                打印手写版
              </Button>
              <Button onClick={exportExcel} disabled={filtered.length === 0}>
                导出 Excel
              </Button>
              <Button onClick={exportAllExcel} disabled={regs.length === 0} variant="outline">
                导出全部 Excel
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left border-b border-border/60 text-muted-foreground bg-muted/80 backdrop-blur-sm">
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
                    <th className="py-2 px-2">城市/邮编</th>
                    <th className="py-2 px-2">信仰</th>
                    <th className="py-2 px-2">婚姻</th>
                    <th className="py-2 px-2">来到方式</th>
                    <th className="py-2 px-2">标记</th>
                    <th className="py-2 px-2">跟进人</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r) => (
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
                        {formatReferrer(r) || "—"}
                      </td>
                      <td className="py-2 px-2 space-x-1 whitespace-nowrap">
                        {r.wants_visit && <Tag>欢迎探访</Tag>}
                        {r.wants_info && <Tag tone="accent">需资料</Tag>}
                      </td>
                      <td className="py-2 px-2">
                        {editingFollowUpId === r.id ? (
                          <input
                            autoFocus
                            value={followUpDraft}
                            onChange={(e) => setFollowUpDraft(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                const val = followUpDraft.trim();
                                const { error } = await supabase
                                  .from("registrations")
                                  .update({ follow_up_person: val || null })
                                  .eq("id", r.id);
                                if (error) toast.error(error.message);
                                else {
                                  setRegs((prev) => prev.map((x) => x.id === r.id ? { ...x, follow_up_person: val || null } : x));
                                  setEditingFollowUpId(null);
                                  toast.success("已保存");
                                }
                              } else if (e.key === "Escape") {
                                setEditingFollowUpId(null);
                              }
                            }}
                            onBlur={() => setEditingFollowUpId(null)}
                            className="bg-transparent border border-border/60 rounded px-1 py-0.5 text-xs w-20"
                            placeholder="姓名"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={r.follow_up_person ? "" : "text-muted-foreground"}>
                              {r.follow_up_person || "—"}
                            </span>
                            <button
                              onClick={() => {
                                setFollowUpDraft(r.follow_up_person ?? "");
                                setEditingFollowUpId(r.id);
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              编辑
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right space-x-3 whitespace-nowrap">
                        <button onClick={() => { setEditForm({ ...r }); setEditOpen(true); }} className="text-xs text-primary hover:underline">编辑</button>
                        <button onClick={() => deleteReg(r.id)} className="text-xs text-destructive hover:underline">删除</button>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={16} className="py-12 text-center text-muted-foreground">
                        暂无登记记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                共 {filtered.length} 条，第 {page}/{totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </section>
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-serif text-xl">人数统计</h2>
            <Button size="sm" variant="outline" onClick={loadData}>刷新</Button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            手动录入每周到会人数。今日总人数 = 大堂敬拜 + 儿童主日学学生 + 儿童主日学老师。今日新人 来自登记名单当日数据。
          </p>

          {(() => {
            const w = parseInt(attWorship || "0", 10) || 0;
            const s = parseInt(attStudents || "0", 10) || 0;
            const t = parseInt(attTeachers || "0", 10) || 0;
            const total = w + s + t;
            const toLocalDate = (iso: string) => {
              const d = new Date(iso);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              return `${y}-${m}-${day}`;
            };
            const newcomers = regs.filter((r) => toLocalDate(r.created_at) === attDate).length;
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-4">
                  <div>
                    <Label className="text-xs">日期</Label>
                    <Input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">大堂敬拜人数</Label>
                    <Input type="number" min={0} value={attWorship} onChange={(e) => setAttWorship(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs">儿童主日学学生</Label>
                    <Input type="number" min={0} value={attStudents} onChange={(e) => setAttStudents(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs">儿童主日学老师</Label>
                    <Input type="number" min={0} value={attTeachers} onChange={(e) => setAttTeachers(e.target.value)} placeholder="0" />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!attDate) { toast.error("请选择日期"); return; }
                      const payload = {
                        record_date: attDate,
                        worship_count: w,
                        children_students: s,
                        children_teachers: t,
                      };
                      const { error } = await supabase
                        .from("attendance_records")
                        .upsert(payload, { onConflict: "record_date" });
                      if (error) { toast.error(error.message); return; }
                      toast.success("已保存");
                      logAction(`保存了 ${attDate} 的人数统计`);
                      loadData();
                    }}
                  >保存 / 更新</Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-xl border border-border/50 p-3">
                    <div className="text-xs text-muted-foreground">大堂敬拜</div>
                    <div className="text-2xl font-serif">{w}</div>
                  </div>
                  <div className="rounded-xl border border-border/50 p-3">
                    <div className="text-xs text-muted-foreground">儿童学生 + 老师</div>
                    <div className="text-2xl font-serif">{s + t}</div>
                  </div>
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                    <div className="text-xs text-muted-foreground">今日总人数</div>
                    <div className="text-2xl font-serif">{total}</div>
                  </div>
                  <div className="rounded-xl border border-border/50 p-3">
                    <div className="text-xs text-muted-foreground">今日新人</div>
                    <div className="text-2xl font-serif">{newcomers}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const text =
                        `【主日聚会人数统计】\n` +
                        `日期：${attDate}\n` +
                        `大堂敬拜：${w} 人\n` +
                        `儿童主日学（学生）：${s} 人\n` +
                        `儿童主日学（老师）：${t} 人\n` +
                        `今日总人数：${total} 人\n` +
                        `今日新人：${newcomers} 人`;
                      setAttText(text);
                      const rec = {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        date: attDate,
                        text,
                        savedAt: new Date().toISOString(),
                      };
                      persistAttTextRecords([rec, ...attTextRecords].slice(0, 50));
                      toast.success("已生成并保存记录");
                    }}
                  >生成文本</Button>
                  <Button
                    size="sm"
                    disabled={!attText}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(attText);
                        toast.success("已复制，可粘贴到微信");
                      } catch {
                        toast.error("复制失败，请手动选中复制");
                      }
                    }}
                  >复制文本</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!attText}
                    onClick={() => setAttText("")}
                  >删除文本</Button>
                </div>
                {attText && (
                  <Textarea
                    readOnly
                    value={attText}
                    rows={8}
                    className="font-mono text-sm"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                )}
                {attTextRecords.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">文本记录</h3>
                    <div className="space-y-2">
                      {attTextRecords.map((r) => (
                        <div
                          key={r.id}
                          className="border border-border/50 rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                            <div className="text-xs text-muted-foreground">
                              {r.date} · 保存于 {new Date(r.savedAt).toLocaleString("zh-CN")}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAttText(r.text)}
                              >查看</Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(r.text);
                                    toast.success("已复制");
                                  } catch {
                                    toast.error("复制失败");
                                  }
                                }}
                              >复制</Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (!confirm("删除该记录?")) return;
                                  persistAttTextRecords(
                                    attTextRecords.filter((x) => x.id !== r.id),
                                  );
                                }}
                              >删除</Button>
                            </div>
                          </div>
                          <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">{r.text}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {attendance.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">历史记录</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border/60 text-muted-foreground">
                      <th className="py-2 px-2">日期</th>
                      <th className="py-2 px-2">大堂</th>
                      <th className="py-2 px-2">儿童学生</th>
                      <th className="py-2 px-2">儿童老师</th>
                      <th className="py-2 px-2">总人数</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.slice(0, 12).map((a) => {
                      const tot = a.worship_count + a.children_students + a.children_teachers;
                      return (
                        <tr key={a.id} className="border-b border-border/40">
                          <td className="py-2 px-2">{a.record_date}</td>
                          <td className="py-2 px-2">{a.worship_count}</td>
                          <td className="py-2 px-2">{a.children_students}</td>
                          <td className="py-2 px-2">{a.children_teachers}</td>
                          <td className="py-2 px-2 font-medium">{tot}</td>
                          <td className="py-2 px-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAttDate(a.record_date);
                                setAttWorship(String(a.worship_count));
                                setAttStudents(String(a.children_students));
                                setAttTeachers(String(a.children_teachers));
                              }}
                            >编辑</Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (!confirm(`删除 ${a.record_date} 的记录?`)) return;
                                const { error } = await supabase
                                  .from("attendance_records")
                                  .delete()
                                  .eq("id", a.id);
                                if (error) { toast.error(error.message); return; }
                                toast.success("已删除");
                                loadData();
                              }}
                            >删除</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
            </TabsContent>

            <TabsContent value="media" className="space-y-8 mt-0">
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
            </TabsContent>

            <TabsContent value="kitchen" className="space-y-8 mt-0">
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-xl mb-4">厨房侍工</h2>
          <p className="text-sm text-muted-foreground">敬请期待，此模块尚在开发中。</p>
        </section>
            </TabsContent>

            <TabsContent value="sunday" className="space-y-8 mt-0">
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-xl mb-4">主日学</h2>
          <p className="text-sm text-muted-foreground">敬请期待，此模块尚在开发中。</p>
        </section>
            </TabsContent>

            <TabsContent value="events" className="space-y-8 mt-0">
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <h2 className="font-serif text-xl">教会活动</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">二维码状态:</span>
              {events.some((e) => e.is_active) ? (
                <span className="font-medium text-green-600">二维码工作中</span>
              ) : (
                <span className="font-medium text-foreground">二维码已停用</span>
              )}
            </div>
          </div>
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
            </TabsContent>

          </fieldset>
        </Tabs>

        <fieldset disabled={!isAdmin} className="contents">
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-xl mb-4">教会服侍</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {/* 服侍申请 QR */}
            <div className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
              <p className="font-medium">服侍申请</p>
              {origin && (
                <QRCodeSVG value={`${origin}/serve-apply`} size={180} level="H" />
              )}
              <p className="text-xs text-muted-foreground break-all text-center">{origin}/serve-apply</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${origin}/serve-apply`);
                    toast.success("链接已复制");
                  }}
                >
                  复制链接
                </Button>
                <Button size="sm" onClick={() => setServiceListOpen(true)}>
                  查看信息 ({serviceApps.length})
                </Button>
              </div>
            </div>

            {/* 问题反馈 QR */}
            <div className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
              <p className="font-medium">问题反馈</p>
              {origin && (
                <QRCodeSVG value={`${origin}/feedback`} size={180} level="H" />
              )}
              <p className="text-xs text-muted-foreground break-all text-center">{origin}/feedback</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${origin}/feedback`);
                    toast.success("链接已复制");
                  }}
                >
                  复制链接
                </Button>
                <Button size="sm" onClick={() => setFeedbackListOpen(true)}>
                  查看信息 ({feedbacks.length})
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">管理员权限</h2>
            <Button size="sm" variant="outline" onClick={loadUsers} disabled={usersLoading}>
              {usersLoading ? "刷新中..." : "刷新"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            新注册用户默认为「待审核」，须由主管理员在此分配角色后才能登录。
            <br />
            <span className="text-foreground/70">角色权限：</span>
            <span className="ml-1">管理员 = 可修改所有设置；</span>
            <span>一般用户 = 仅可查看系统（不可修改设置）；</span>
            <span>访客 = 仅能登录 / 退出。</span>
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
                  const currentRole = u.roles.includes("admin")
                    ? "admin"
                    : u.roles.includes("user")
                      ? "user"
                      : u.roles.includes("viewer")
                        ? "viewer"
                        : "";
                  const isSelf = u.id === currentUserId;
                  const PROTECTED_ADMINS = ["hoc3nc@gmail.com", "charmzhangliang@gmail.com"];
                  const isProtected = PROTECTED_ADMINS.includes(u.email.toLowerCase());
                  const isPending = currentRole === "";
                  const pendingRole = pendingRoleSelections[u.id] ?? "viewer";
                  return (
                    <tr key={u.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">
                        {u.email} {isSelf && <span className="text-xs text-muted-foreground">(我)</span>}
                        {isPending && <span className="ml-2 text-xs text-amber-600">待审核</span>}
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={isPending ? pendingRole : currentRole}
                          disabled={isProtected || (isSelf && currentRole === "admin")}
                          onChange={async (e) => {
                            const newRole = e.target.value as "" | "admin" | "user" | "viewer";
                            if (isPending) {
                              // Just track selection; don't apply until 确定 clicked
                              setPendingRoleSelections((prev) => ({
                                ...prev,
                                [u.id]: (newRole || "viewer") as "admin" | "user" | "viewer",
                              }));
                              return;
                            }
                            const label =
                              newRole === "admin" ? "管理员"
                              : newRole === "user" ? "一般用户"
                              : newRole === "viewer" ? "访客"
                              : "待审核 (撤销权限)";
                            if (!confirm(`将 ${u.email} 设置为「${label}」?`)) {
                              return;
                            }
                            try {
                              await setUserRoleFn({
                                data: { userId: u.id, role: newRole === "" ? null : newRole },
                              });
                              logAction(`将 ${u.email} 角色设为 ${label}`);
                              toast.success("已更新角色");
                              loadUsers();
                            } catch (err) {
                              toast.error((err as Error).message);
                            }
                          }}
                          className="text-xs bg-background border border-border rounded px-2 py-1"
                        >
                          {!isPending && <option value="">待审核</option>}
                          <option value="admin">管理员</option>
                          <option value="user">一般用户</option>
                          <option value="viewer">访客</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="py-2 px-2 text-right space-x-3 whitespace-nowrap">
                        {isPending && (
                          <button
                            onClick={async () => {
                              const chosen = pendingRoleSelections[u.id] ?? "viewer";
                              const label =
                                chosen === "admin" ? "管理员"
                                : chosen === "user" ? "一般用户"
                                : "访客";
                              if (!confirm(`通过 ${u.email} 的申请,并设为「${label}」?`)) return;
                              try {
                                await setUserRoleFn({ data: { userId: u.id, role: chosen } });
                                logAction(`通过了 ${u.email} 的申请,角色: ${label}`);
                                toast.success("已通过申请");
                                loadUsers();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                            className="text-xs text-emerald-600 hover:underline font-medium"
                          >
                            确定
                          </button>
                        )}
                        <button
                          disabled={isSelf || isProtected}
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
        </fieldset>

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
                    <Label>城市</Label>
                    <Input value={editForm.city ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, city: e.target.value } : prev)} />
                  </div>
                  <div className="space-y-2">
                    <Label>邮编</Label>
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
                  <Label>如何知道我们教会</Label>
                  <RadioGroup value={editForm.referrer_type ?? ""} onValueChange={(v) => setEditForm((prev) => prev ? { ...prev, referrer_type: v } : prev)} className="flex flex-wrap gap-4 pt-2">
                    {[
                      { v: "self", l: "自己" },
                      { v: "friend", l: "亲友" },
                      { v: "wechat", l: "微信/小红书" },
                      { v: "youtube", l: "YouTube" },
                      { v: "missionary", l: "宣教士" },
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
                  {editForm.referrer_type === "missionary" && (
                    <Input className="mt-3" placeholder="宣教士姓名" value={editForm.invited_by ?? ""} onChange={(e) => setEditForm((prev) => prev ? { ...prev, invited_by: e.target.value } : prev)} />
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
        <Dialog open={serviceListOpen} onOpenChange={setServiceListOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>服侍申请名单</DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border/60 text-muted-foreground">
                    <th className="py-2 px-2">时间</th>
                    <th className="py-2 px-2">姓名</th>
                    <th className="py-2 px-2">性别</th>
                    <th className="py-2 px-2">电话</th>
                    <th className="py-2 px-2">微信</th>
                    <th className="py-2 px-2">服侍项目</th>
                    <th className="py-2 px-2">备注</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {serviceApps.map((s) => (
                    <tr key={s.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                        {new Date(s.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 px-2 font-medium">{s.name}</td>
                      <td className="py-2 px-2">{s.gender ?? "—"}</td>
                      <td className="py-2 px-2">{s.phone ?? "—"}</td>
                      <td className="py-2 px-2">{s.wechat ?? "—"}</td>
                      <td className="py-2 px-2">{s.service_project}</td>
                      <td className="py-2 px-2 text-muted-foreground">{s.notes ?? "—"}</td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={async () => {
                            if (!confirm(`确认删除 ${s.name} 的申请?`)) return;
                            const { error } = await supabase.from("service_applications").delete().eq("id", s.id);
                            if (error) toast.error(error.message);
                            else {
                              setServiceApps((prev) => prev.filter((x) => x.id !== s.id));
                              logAction(`删除了服侍申请 ${s.name}`);
                              toast.success("已删除");
                            }
                          }}
                          className="text-xs text-destructive hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {serviceApps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        暂无服侍申请
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button onClick={() => setServiceListOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 问题反馈 列表 */}
        <Dialog open={feedbackListOpen} onOpenChange={setFeedbackListOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>问题反馈名单</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {feedbacks.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setFeedbackDetail(f)}
                  className="border border-border/40 rounded-lg p-3 space-y-2 cursor-pointer hover:bg-accent/30 transition"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium">{f.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString("zh-CN")} · {f.name} · {f.contact}
                        {f.fellowship ? ` · ${f.fellowship}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`确认删除 ${f.name} 的反馈?`)) return;
                        const { error } = await supabase.from("feedbacks").delete().eq("id", f.id);
                        if (error) toast.error(error.message);
                        else {
                          setFeedbacks((prev) => prev.filter((x) => x.id !== f.id));
                          logAction(`删除了问题反馈 ${f.name}`);
                          toast.success("已删除");
                        }
                      }}
                      className="text-xs text-destructive hover:underline shrink-0"
                    >
                      删除
                    </button>
                  </div>
                  {f.description && (
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">{f.description}</p>
                  )}
                  {f.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {f.images.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          <img src={url} alt="" className="w-full h-20 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {feedbacks.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">暂无问题反馈</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setFeedbackListOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 问题反馈 详情 */}
        <Dialog open={!!feedbackDetail} onOpenChange={(o) => !o && setFeedbackDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>反馈详情</DialogTitle>
            </DialogHeader>
            {feedbackDetail && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-[88px_1fr] gap-y-3 gap-x-3">
                  <div className="text-muted-foreground">时间</div>
                  <div>{new Date(feedbackDetail.created_at).toLocaleString("zh-CN")}</div>
                  <div className="text-muted-foreground">姓名</div>
                  <div>{feedbackDetail.name}</div>
                  <div className="text-muted-foreground">联系方式</div>
                  <div>{feedbackDetail.contact}</div>
                  <div className="text-muted-foreground">团契</div>
                  <div>{feedbackDetail.fellowship || "—"}</div>
                  <div className="text-muted-foreground">标题</div>
                  <div className="font-medium">{feedbackDetail.title}</div>
                  <div className="text-muted-foreground">内容</div>
                  <div className="whitespace-pre-wrap">{feedbackDetail.description || "—"}</div>
                </div>
                {feedbackDetail.images.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-2">图片</div>
                    <div className="grid grid-cols-3 gap-2">
                      {feedbackDetail.images.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" className="w-full h-28 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDetail(null)}>关闭</Button>
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
                  if (evErr) {
                    setInitLoading(false);
                    toast.error("清空活动失败: " + evErr.message);
                    return;
                  }
                  const { error: msgErr } = await supabase
                    .from("messages")
                    .delete()
                    .not("id", "is", null);
                  if (msgErr) {
                    setInitLoading(false);
                    toast.error("清空留言板失败: " + msgErr.message);
                    return;
                  }
                  const { error: svcErr } = await supabase
                    .from("service_applications")
                    .delete()
                    .not("id", "is", null);
                  if (svcErr) {
                    setInitLoading(false);
                    toast.error("清空服侍申请失败: " + svcErr.message);
                    return;
                  }
                  const { error: fbErr } = await supabase
                    .from("feedbacks")
                    .delete()
                    .not("id", "is", null);
                  setInitLoading(false);
                  if (fbErr) {
                    toast.error("清空问题反馈失败: " + fbErr.message);
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

function NowLabel() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateStr = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const timeStr = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return (
    <span className="text-sm font-sans text-muted-foreground font-normal">
      {dateStr} {timeStr}
    </span>
  );
}