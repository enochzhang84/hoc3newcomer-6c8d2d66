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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, User } from "lucide-react";
import { format } from "date-fns";
import { ScreenManager } from "@/components/admin/ScreenManager";
import { AVMinistryWorkspace } from "@/components/admin/AVMinistryWorkspace";
import { zhCN } from "date-fns/locale";
import { listUsersWithRoles, setUserRole, deleteUser, createUserWithRole, updateUserWorkerName } from "@/lib/users.functions";
import { updateRegistration } from "@/lib/registrations.functions";
import { HospitalityCalendarSection } from "@/components/HospitalityCalendar";
import { HospitalityRankingSection } from "@/components/HospitalityRanking";
import { DutyCalendarSection } from "@/components/DutyCalendar";
import MealPlanCalendar from "@/components/MealPlanCalendar";
import EventMealNotebook from "@/components/EventMealNotebook";
import MinistryServiceCalendar from "@/components/MinistryServiceCalendar";

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
  source_channel: string | null;
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
    case "other": return `其他:${r.referrer_other ?? ""}`;
    default: return "";
  }
}

function formatSourceChannel(r: Pick<Reg, "source_channel">): string {
  switch (r.source_channel) {
    case "chatgpt": return "ChatGPT";
    case "maps": return "谷歌/苹果地图";
    case "wechat": return "微信/小红书";
    case "youtube": return "YouTube";
    case "missionary": return "宣教士";
    default: return "";
  }
}

type AppUser = { id: string; email: string; created_at: string; roles: string[]; worker_name?: string | null; service_project?: string | null };

type CachedAuthUser = { id: string; email?: string | null };

function getCachedAuthUser(): CachedAuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const authKeys = Object.keys(window.localStorage).filter(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
    for (const key of authKeys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession ?? parsed?.session ?? parsed;
      const user = session?.user ?? parsed?.user;
      if (user?.id) return { id: user.id, email: user.email ?? null };
    }
  } catch {
    // ignore broken cached auth data
  }
  return null;
}

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

type Course = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type Fellowship = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type SundayCheckin = {
  id: string;
  checkin_date: string;
  name: string;
  contact: string | null;
  email: string | null;
  course_id: string | null;
  course_name: string | null;
  created_at: string;
};

type FellowshipCheckin = {
  id: string;
  checkin_date: string;
  name: string;
  contact: string | null;
  email: string | null;
  fellowship: string;
  prayer_request: string | null;
  created_at: string;
};

type MealType = { id: string; name: string; sort_order: number; is_active: boolean };
type MealPlan = {
  id: string;
  plan_date: string;
  attendees: number;
  meal_type: string | null;
  notes: string | null;
  category?: string;
};
type DutyPerson = { id: string; name: string; sort_order: number; is_active: boolean };
type DutySchedule = {
  id: string;
  schedule_type: "sunday" | "summer";
  slot_time: string;
  ppt_person: string | null;
  live_person: string | null;
  live_person_2?: string | null;
  sort_order: number;
};

type SundayTeacher = { id: string; name: string; sort_order: number; is_active: boolean };

type AdultCheckin = {
  id: string;
  kind: "summer" | "fall";
  name: string;
  fellowship: string | null;
  notes: string | null;
  checkin_at: string;
};

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  fellowship: string | null;
  notes: string | null;
  created_at: string;
};

const CONTACT_FELLOWSHIPS: string[] = [
  "小羊團契",
  "Chadbourne",
  "單身職業青年小組",
  "粵語團契",
  "幸福聊天室",
  "恩典茶經小組",
  "長青團契",
  "活水團契",
  "愛加倍團契(園區)",
  "愛加倍團契(山區)",
  "愛加倍團契(湖區)",
  "愛加倍團契(以諾一組)",
  "愛加倍團契(以諾二組)",
  "中區查經班",
  "神州團契",
  "神州約書亞小組",
  "Ohlone",
  "Weibel 迦勒團契",
  "磐石團契(隔週)",
  "北區查經",
];

type KidsRow = {
  id: string;
  track: string;
  class_name: string | null;       // 班级 stored in class_name
  teacher_name: string | null;     // 老师
  class_location: string | null;   // 地点
  student_count: number | null;    // 人数（手动录入）
  sort_order: number;
};

const KIDS_TRACKS = {
  spring: { key: "kids_spring_2026", title: "2026年春季儿童主日学" },
  fall: { key: "kids_fall_2026", title: "2026 秋季儿童主日学" },
} as const;

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function YearFilterPicker({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const nowY = new Date().getFullYear();
  const years: number[] = [];
  for (let y = nowY - 5; y <= nowY + 2; y++) years.push(y);
  if (!years.includes(value)) years.push(value);
  years.sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => onChange(value - 1)} aria-label="上一年">‹</Button>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-xs bg-background border border-input rounded px-2 cursor-pointer"
        aria-label="选择年份"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}年</option>
        ))}
      </select>
      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => onChange(value + 1)} aria-label="下一年">›</Button>
      {value !== nowY && (
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onChange(nowY)}>今年</Button>
      )}
    </div>
  );
}

// 月份范围（YYYY-MM）选择器
function MonthRangePicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ym = (y: number, m: number) => `${y}-${pad(m)}`;
  const setPreset = (key: string) => {
    if (key === "thisYear") onChange(ym(curY, 1), ym(curY, 12));
    else if (key === "lastYear") onChange(ym(curY - 1, 1), ym(curY - 1, 12));
    else if (key === "thisQuarter") {
      const q = Math.floor((curM - 1) / 3);
      onChange(ym(curY, q * 3 + 1), ym(curY, q * 3 + 3));
    } else if (key === "lastQuarter") {
      let q = Math.floor((curM - 1) / 3) - 1;
      let y = curY;
      if (q < 0) { q = 3; y -= 1; }
      onChange(ym(y, q * 3 + 1), ym(y, q * 3 + 3));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">从</span>
        <input
          type="month"
          value={start}
          onChange={(e) => onChange(e.target.value || start, end)}
          className="h-8 text-xs bg-background border border-input rounded px-2"
        />
        <span className="text-muted-foreground">到</span>
        <input
          type="month"
          value={end}
          onChange={(e) => onChange(start, e.target.value || end)}
          className="h-8 text-xs bg-background border border-input rounded px-2"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("thisYear")}>今年</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("lastYear")}>去年</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("thisQuarter")}>本季度</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("lastQuarter")}>上季度</Button>
      </div>
    </div>
  );
}

// 年 / 月 / 日 多级筛选
type DateLevelFilter = { year: number; month: number | null; day: number | null };
function DateLevelPicker({
  value,
  onChange,
}: {
  value: DateLevelFilter;
  onChange: (v: DateLevelFilter) => void;
}) {
  const now = new Date();
  const curY = now.getFullYear();
  const years: number[] = [];
  for (let y = curY - 5; y <= curY + 2; y++) years.push(y);
  if (!years.includes(value.year)) years.push(value.year);
  years.sort((a, b) => a - b);
  const daysInMonth = value.month ? new Date(value.year, value.month, 0).getDate() : 31;
  const setPreset = (key: string) => {
    if (key === "today") onChange({ year: curY, month: now.getMonth() + 1, day: now.getDate() });
    else if (key === "thisMonth") onChange({ year: curY, month: now.getMonth() + 1, day: null });
    else if (key === "thisYear") onChange({ year: curY, month: null, day: null });
    else if (key === "lastYear") onChange({ year: curY - 1, month: null, day: null });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 text-xs">
        <select
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className="h-8 text-xs bg-background border border-input rounded px-2 cursor-pointer"
        >
          {years.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select
          value={value.month ?? ""}
          onChange={(e) => {
            const m = e.target.value === "" ? null : Number(e.target.value);
            onChange({ ...value, month: m, day: m === null ? null : value.day });
          }}
          className="h-8 text-xs bg-background border border-input rounded px-2 cursor-pointer"
        >
          <option value="">全年</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
        <select
          value={value.day ?? ""}
          disabled={value.month === null}
          onChange={(e) => onChange({ ...value, day: e.target.value === "" ? null : Number(e.target.value) })}
          className="h-8 text-xs bg-background border border-input rounded px-2 cursor-pointer disabled:opacity-50"
        >
          <option value="">全月</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}日</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("today")}>今天</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("thisMonth")}>本月</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("thisYear")}>今年</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPreset("lastYear")}>去年</Button>
      </div>
    </div>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRole, setUserRoleState] = useState<"super_admin" | "admin" | "user" | "viewer" | null>(null);
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
  const [pendingRoleSelections, setPendingRoleSelections] = useState<Record<string, "super_admin" | "admin" | "user" | "viewer">>({});
  const [messagesCount, setMessagesCount] = useState(0);
  const [serviceApps, setServiceApps] = useState<ServiceApp[]>([]);
  const [serviceListOpen, setServiceListOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackListOpen, setFeedbackListOpen] = useState(false);
  const [feedbackDetail, setFeedbackDetail] = useState<Feedback | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [sundayCheckins, setSundayCheckins] = useState<SundayCheckin[]>([]);
  const [fellowshipCheckins, setFellowshipCheckins] = useState<FellowshipCheckin[]>([]);
  const [activeCourseTab, setActiveCourseTab] = useState<string>("");
  const [fellowships, setFellowships] = useState<Fellowship[]>([]);
  const [fellowshipsOpen, setFellowshipsOpen] = useState(false);
  const [newFellowshipName, setNewFellowshipName] = useState("");
  const [activeFellowshipTab, setActiveFellowshipTab] = useState<string>("");
  const [coursePages, setCoursePages] = useState<Record<string, number>>({});
  const [fellowshipPages, setFellowshipPages] = useState<Record<string, number>>({});
  const TAB_PAGE_SIZE = 10;
  const [mainTab, setMainTab] = useState("stats");
  const [statsSubTab, setStatsSubTab] = useState<
    "overview" | "newcomer" | "sunday" | "meals" | "service" | "baptism" | "annual"
  >("overview");
  const [kidsEnrollOpen, setKidsEnrollOpen] = useState(false);
  const [sundayParticipationOpen, setSundayParticipationOpen] = useState(false);
  const [retreatCount, setRetreatCount] = useState<number>(0);
  const [ministryWorkerYearCount, setMinistryWorkerYearCount] = useState<number>(0);
  // Adult class checkins (summer / fall)
  const [adultCheckins, setAdultCheckins] = useState<AdultCheckin[]>([]);
  const [adultSort, setAdultSort] = useState<Record<"summer" | "fall", { col: "name" | "fellowship" | "time"; dir: "asc" | "desc" }>>({
    summer: { col: "time", dir: "desc" },
    fall: { col: "time", dir: "desc" },
  });
  const [adultPages, setAdultPages] = useState<Record<"summer" | "fall", number>>({ summer: 1, fall: 1 });
  const ADULT_PAGE_SIZE = 15;
  const [adultDateFilter, setAdultDateFilter] = useState<Record<"summer" | "fall", Date | undefined>>({ summer: undefined, fall: undefined });
  const [adultDateOpen, setAdultDateOpen] = useState<Record<"summer" | "fall", boolean>>({ summer: false, fall: false });
  // Year filters for checkin sections (按年查询)
  const _currentYear = new Date().getFullYear();
  const _pad2 = (n: number) => String(n).padStart(2, "0");
  const _curMonthStr = `${_currentYear}-01`;
  const _curMonthEndStr = `${_currentYear}-12`;
  const [courseRange, setCourseRange] = useState<{ start: string; end: string }>({
    start: _curMonthStr,
    end: _curMonthEndStr,
  });
  const [fellowshipFilter, setFellowshipFilter] = useState<DateLevelFilter>({
    year: _currentYear,
    month: null,
    day: null,
  });
  const [adultYearFilter, setAdultYearFilter] = useState<Record<"summer" | "fall", number>>({ summer: _currentYear, fall: _currentYear });
  // Kitchen meal plans
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [mealTypesOpen, setMealTypesOpen] = useState(false);
  const [newMealTypeName, setNewMealTypeName] = useState("");
  const [newMealDate, setNewMealDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [newMealAttendees, setNewMealAttendees] = useState<string>("");
  const [newMealType, setNewMealType] = useState<string>("");
  const [newMealNotes, setNewMealNotes] = useState<string>("");
  const [kitchenSubTab, setKitchenSubTab] = useState<string>("dining");
  const [kitchenDetailRow, setKitchenDetailRow] = useState<AttendanceRecord | null>(null);
  const [sundaySubTab, setSundaySubTab] = useState<string>("adult");
  const [welcomeSubTab, setWelcomeSubTab] = useState<string>("greet");
  const [mediaSubTab, setMediaSubTab] = useState<string>("live");
  const [youtubeUrl, setYoutubeUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("admin_youtube_live_url") || "";
  });
  const [youtubeUrlInput, setYoutubeUrlInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("admin_youtube_live_url") || "";
  });
  const youtubeVideoId = (() => {
    if (!youtubeUrl) return "";
    try {
      const u = new URL(youtubeUrl.trim());
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return u.pathname.replace(/^\//, "").split("/")[0] || "";
      if (host.endsWith("youtube.com")) {
        if (u.searchParams.get("v")) return u.searchParams.get("v") || "";
        const parts = u.pathname.split("/").filter(Boolean);
        const idx = parts.findIndex((p) => p === "live" || p === "embed" || p === "shorts");
        if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      }
      return "";
    } catch {
      const m = youtubeUrl.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
      return m ? m[1] : "";
    }
  })();
  // Event-meal (其他活动订餐计划) form state — shares meal_plans table via category='event'
  const [newEventMealDate, setNewEventMealDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [newEventMealAttendees, setNewEventMealAttendees] = useState<string>("");
  const [newEventMealType, setNewEventMealType] = useState<string>("");
  const [newEventMealNotes, setNewEventMealNotes] = useState<string>("");
  // Duty rosters
  const [dutyPersonnel, setDutyPersonnel] = useState<DutyPerson[]>([]);
  const [dutySchedules, setDutySchedules] = useState<DutySchedule[]>([]);
  const [dutyPersonnelOpen, setDutyPersonnelOpen] = useState(false);
  const [newDutyPersonName, setNewDutyPersonName] = useState("");

  // Contacts (address book)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactForm, setContactForm] = useState<Partial<Contact> | null>(null);
  const [contactDetail, setContactDetail] = useState<Contact | null>(null);
  const [contactDetailEditing, setContactDetailEditing] = useState(false);
  const [contactDetailDraft, setContactDetailDraft] = useState<Partial<Contact> | null>(null);
  // Online worker names (from user_presence, refreshed every 30s)
  const [onlineWorkers, setOnlineWorkers] = useState<Set<string>>(new Set());
  // Kids Sunday School settings dialog
  const [kidsSettingsSeason, setKidsSettingsSeason] = useState<"spring" | "fall" | null>(null);
  const [kidsNewTeacher, setKidsNewTeacher] = useState("");
  // App settings (editable titles)
  const [appSettings, setAppSettings] = useState<Record<string, string>>({});
  // Kids Sunday School
  const [kidsRows, setKidsRows] = useState<KidsRow[]>([]);
  // Kids class enrollment snapshots (per-class history)
  const [kidsSnapshots, setKidsSnapshots] = useState<
    Array<{ id: string; class_id: string; track: string; class_name: string | null; student_count: number; snapshot_date: string }>
  >([]);
  // Sunday school teachers
  const [sundayTeachers, setSundayTeachers] = useState<SundayTeacher[]>([]);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [courseSettingsTab, setCourseSettingsTab] = useState<"courses" | "teachers">("courses");
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
  const createUserFn = useServerFn(createUserWithRole);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState<{
    email: string;
    password: string;
    role: "super_admin" | "admin" | "user" | "viewer";
    workerName: string;
  }>({ email: "", password: "", role: "user", workerName: "" });
  const [newUserSubmitting, setNewUserSubmitting] = useState(false);
  const updateWorkerNameFn = useServerFn(updateUserWorkerName);
  const [editingWorkerUserId, setEditingWorkerUserId] = useState<string | null>(null);
  const [editingWorkerDraft, setEditingWorkerDraft] = useState<string>("");
  const updateRegFn = useServerFn(updateRegistration);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Reg | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  const [qrLibOpen, setQrLibOpen] = useState(false);
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
    const [{ data: r }, { data: e }, { data: s }, { data: a }, { data: f }, { data: cs }] = await Promise.all([
      supabase.from("registrations").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("created_at", { ascending: true }),
      supabase.from("service_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("attendance_records").select("*").order("record_date", { ascending: false }),
      supabase.from("feedbacks").select("*").order("created_at", { ascending: false }),
      supabase.from("sunday_school_courses").select("*").order("sort_order", { ascending: true }),
    ]);
    setRegs(r ?? []);
    setEvents(e ?? []);
    setServiceApps((s ?? []) as ServiceApp[]);
    setAttendance((a ?? []) as AttendanceRecord[]);
    setFeedbacks((f ?? []) as Feedback[]);
    setCourses((cs ?? []) as Course[]);
  }, []);

  const loadCourses = useCallback(async () => {
    const { data } = await supabase
      .from("sunday_school_courses")
      .select("*")
      .order("sort_order", { ascending: true });
    setCourses((data ?? []) as Course[]);
  }, []);

  const loadSundayCheckins = useCallback(async () => {
    const { data } = await supabase
      .from("sunday_school_checkins")
      .select("*")
      .order("checkin_date", { ascending: false })
      .order("created_at", { ascending: false });
    setSundayCheckins((data ?? []) as SundayCheckin[]);
  }, []);

  const loadFellowshipCheckins = useCallback(async () => {
    const { data } = await supabase
      .from("fellowship_checkins")
      .select("*")
      .order("checkin_date", { ascending: false })
      .order("created_at", { ascending: false });
    setFellowshipCheckins((data ?? []) as FellowshipCheckin[]);
  }, []);

  const loadAdultCheckins = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("adult_class_checkins")
      .select("*")
      .order("checkin_at", { ascending: false });
    setAdultCheckins((data ?? []) as AdultCheckin[]);
  }, []);

  const loadFellowships = useCallback(async () => {
    const { data } = await supabase
      .from("fellowships")
      .select("*")
      .order("sort_order", { ascending: true });
    setFellowships((data ?? []) as Fellowship[]);
  }, []);

  const loadMealTypes = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("meal_types")
      .select("*")
      .order("sort_order", { ascending: true });
    setMealTypes((data ?? []) as MealType[]);
  }, []);

  const loadMealPlans = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("meal_plans")
      .select("*")
      .order("plan_date", { ascending: false });
    setMealPlans((data ?? []) as MealPlan[]);
  }, []);

  const loadDutyPersonnel = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("duty_personnel")
      .select("*")
      .order("sort_order", { ascending: true });
    setDutyPersonnel((data ?? []) as DutyPerson[]);
  }, []);

  const loadDutySchedules = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("duty_schedules")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setDutySchedules((data ?? []) as DutySchedule[]);
  }, []);

  const loadContacts = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("contacts")
      .select("*")
      .order("name", { ascending: true });
    setContacts((data ?? []) as Contact[]);
  }, []);

  const loadAppSettings = useCallback(async () => {
    const { data } = await (supabase as any).from("app_settings").select("key,value");
    const map: Record<string, string> = {};
    for (const row of (data ?? []) as { key: string; value: string | null }[]) {
      if (row.value != null) map[row.key] = row.value;
    }
    setAppSettings(map);
  }, []);

  const loadKidsRows = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("sunday_class_schedule")
      .select("*")
      .in("track", [KIDS_TRACKS.spring.key, KIDS_TRACKS.fall.key])
      .order("sort_order", { ascending: true });
    setKidsRows((data ?? []) as KidsRow[]);
  }, []);

  const loadKidsSnapshots = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("kids_class_enrollment_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false });
    setKidsSnapshots((data ?? []) as Array<{
      id: string; class_id: string; track: string; class_name: string | null;
      student_count: number; snapshot_date: string;
    }>);
  }, []);

  const loadSundayTeachers = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("sunday_school_teachers")
      .select("*")
      .order("sort_order", { ascending: true });
    setSundayTeachers((data ?? []) as SundayTeacher[]);
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
    let unsubscribe: (() => void) | undefined;

    const loadAuthorizedData = () => {
      void loadData();
      void loadMessagesCount();
      void loadSundayCheckins();
      void loadFellowshipCheckins();
      void loadFellowships();
      void loadMealTypes();
      void loadMealPlans();
      void loadDutyPersonnel();
      void loadDutySchedules();
      void loadSundayTeachers();
      void loadAdultCheckins();
      void loadUsers();
      void loadContacts();
      void loadAppSettings();
      void loadKidsRows();
      void loadKidsSnapshots();
    };

    const handleSession = (sess: { user: CachedAuthUser } | null) => {
      if (cancelled) return;
      if (resolved && sess) return;
      resolved = true;
      if (!sess) {
        setChecking(false);
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
          const superAdmin = roles?.some((r) => r.role === "super_admin") ?? false;
          const admin = roles?.some((r) => r.role === "admin") ?? false;
          const isUser = roles?.some((r) => r.role === "user") ?? false;
          const isViewer = roles?.some((r) => r.role === "viewer") ?? false;
          const role: "super_admin" | "admin" | "user" | "viewer" | null =
            superAdmin ? "super_admin" : admin ? "admin" : isUser ? "user" : isViewer ? "viewer" : null;
          setIsSuperAdmin(superAdmin);
          setIsAdmin(admin || superAdmin);
          setUserRoleState(role);
          setChecking(false);
          if (role) loadAuthorizedData();
        } catch {
          if (!cancelled) {
            toast.error("后台权限加载失败，请刷新后重试");
            setChecking(false);
          }
        } finally {
          initializing = false;
        }
      })();
    };

    const loadingGuard = window.setTimeout(() => {
      if (cancelled || resolved) return;
      const cachedUser = getCachedAuthUser();
      if (cachedUser) {
        handleSession({ user: cachedUser });
        return;
      }
      handleSession(null);
    }, 4500);

    try {
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
      unsubscribe = () => sub.subscription.unsubscribe();
    } catch {
      const cachedUser = getCachedAuthUser();
      handleSession(cachedUser ? { user: cachedUser } : null);
    }

    void (async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500)),
        ]);
        if (cancelled || resolved) return;
        if (result && "data" in result) {
          handleSession(result.data.session ? { user: result.data.session.user } : null);
          return;
        }
        const cachedUser = getCachedAuthUser();
        handleSession(cachedUser ? { user: cachedUser } : null);
      } catch {
        if (!cancelled && !resolved) {
          const cachedUser = getCachedAuthUser();
          handleSession(cachedUser ? { user: cachedUser } : null);
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(loadingGuard);
      unsubscribe?.();
    };
  }, [
    navigate,
    loadData,
    loadUsers,
    loadMessagesCount,
    loadSundayCheckins,
    loadFellowshipCheckins,
    loadFellowships,
    loadMealTypes,
    loadMealPlans,
    loadDutyPersonnel,
    loadDutySchedules,
    loadSundayTeachers,
    loadAdultCheckins,
    loadContacts,
    loadAppSettings,
    loadKidsRows,
    loadKidsSnapshots,
  ]);

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

  // Online workers — single source of truth: user_presence table
  // 60s window aligned with 15s heartbeat. Realtime subscription so all
  // devices show identical online status without manual refresh.
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const since = new Date(Date.now() - 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from("user_presence")
        .select("worker_name")
        .gte("last_seen_at", since);
      if (stopped) return;
      const set = new Set<string>();
      for (const r of (data ?? []) as { worker_name: string | null }[]) {
        const n = (r.worker_name ?? "").trim();
        if (n) set.add(n);
      }
      setOnlineWorkers(set);
    };
    load();
    const t = setInterval(load, 20 * 1000);
    const ch = supabase
      .channel("admin_user_presence_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => load(),
      )
      .subscribe();
    return () => {
      stopped = true;
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, []);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中...</div>;
  if (!userRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">您的账号尚未审核，请联系管理员授权</p>
        <Button onClick={async () => {
          try {
            const { data } = await supabase.auth.getUser();
            if (data.user) await (supabase as any).from("user_presence").delete().eq("user_id", data.user.id);
          } catch {}
          await supabase.auth.signOut();
          navigate({ to: "/login" });
        }}>退出登录</Button>
      </div>
    );
  }

  const eventMap = Object.fromEntries(events.map((e) => [e.id, e.name]));
  // Use published domain for QR codes so WeChat (and other in-app browsers)
  // don't land on a preview URL that requires the developer login.
  const publicBase = (() => {
    if (!origin) return "";
    try {
      const host = new URL(origin).host;
      if (
        host.startsWith("id-preview--") ||
        host.endsWith("-dev.lovable.app") ||
        host.endsWith(".lovableproject.com") ||
        host === "localhost" ||
        host.startsWith("127.0.0.1") ||
        host.startsWith("localhost:")
      ) {
        return "https://hoc3newcomer.lovable.app";
      }
    } catch {
      // fall through
    }
    return origin;
  })();
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
      介绍人: formatReferrer(r),
      来源: formatSourceChannel(r),
      欢迎探访: r.wants_visit ? "是" : "否",
      需要资料: r.wants_info ? "是" : "否",
      备注: r.notes ?? "",
      录入方式: r.source === "qr" ? "扫码" : "手动",
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
      const isMale = g === "男" || g === "male";
      const isFemale = g === "女" || g === "female";
      return `${isMale ? "☑" : "☐"}男　${isFemale ? "☑" : "☐"}女`;
    };
    const maritalText = (r: Reg) => {
      const m = r.marital_status ?? "";
      return `${m === "married" ? "☑" : "☐"}已婚　配偶姓名：${esc(r.spouse_name ?? "")}　${m === "single" ? "☑" : "☐"}單身`;
    };
    const referrerText = (r: Reg) => {
      const t = r.referrer_type ?? "";
      const friendName = t === "friend" ? esc(r.invited_by ?? "") : "";
      const otherText = t === "other" ? esc(r.referrer_other ?? "") : "";
      return `${t === "self" ? "☑" : "☐"}自己　${t === "friend" ? "☑" : "☐"}親友姓名 ${friendName}　${t === "other" ? "☑" : "☐"}其他 ${otherText}`;
    };
    const sourceChannelText = (r: Reg) => {
      const s = r.source_channel ?? "";
      const m = (v: string) => (s === v ? "☑" : "☐");
      return `${m("chatgpt")}ChatGPT　${m("maps")}谷歌/蘋果地圖　${m("wechat")}微信/小紅書　${m("youtube")}YouTube　${m("missionary")}宣教士`;
    };
    const wantsText = (r: Reg) =>
      `${r.wants_visit ? "☑" : "☐"}我歡迎教會牧者探訪我　${r.wants_info ? "☑" : "☐"}我需要教會的資料及聯絡`;

    const renderForm = (r: Reg) => {
      const date = new Date(r.created_at).toLocaleDateString("zh-CN");
      return `
        <div class="form">
          <h2>基督之家第三家新人資料表</h2>
          <div class="row"><span class="lbl">日期：</span><span class="val grow">${esc(date)}</span></div>
          <div class="row"><span class="lbl">姓名：(中)</span><span class="val">${esc(r.name)}</span><span class="lbl">(英)</span><span class="val">${esc(r.name_en ?? "")}</span><span class="lbl right">性別：${genderText(r)}</span></div>
          <div class="row"><span class="lbl">地址：</span><span class="val grow">${esc(r.address ?? "")}</span></div>
          <div class="row"><span class="lbl">City：</span><span class="val">${esc(r.city ?? "")}</span><span class="lbl">ZIP：</span><span class="val">${esc(r.zip ?? "")}</span></div>
          <div class="row"><span class="lbl">電話：</span><span class="val">${esc(r.phone ?? "")}</span><span class="lbl">電郵地址：</span><span class="val grow">${esc(r.email ?? "")}</span></div>
          <div class="row"><span class="lbl">信仰：</span><span class="val grow">${faithText(r)}</span></div>
          <div class="row"><span class="lbl">年齡：</span><span class="val grow">${ageText(r)}</span></div>
          <div class="row"><span class="lbl">婚姻：</span><span class="val grow">${maritalText(r)}</span></div>
          <div class="row"><span class="lbl">介紹人：</span><span class="val grow">${referrerText(r)}</span></div>
          <div class="row"><span class="lbl">來源：</span><span class="val grow">${sourceChannelText(r)}</span></div>
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
          invited_by: editForm.referrer_type === "friend" ? editForm.invited_by?.trim() || null : null,
          referrer_other: editForm.referrer_type === "other" ? editForm.referrer_other?.trim() || null : null,
          source_channel: editForm.source_channel || null,
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
          source_channel: r.source_channel ?? null,
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b border-border/60 bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="font-serif text-lg sm:text-xl flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 leading-relaxed">
            <span className="whitespace-normal sm:whitespace-nowrap">基督之家第三家 控制面板</span>
            <NowLabel />
          </Link>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setContactsOpen(true)}>
                通讯录 ({contacts.length})
              </Button>
            )}
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
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground px-2 py-1 rounded-md bg-muted/60 max-w-[200px] truncate" title={currentUserEmail}>
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{currentUserEmail}</span>
            </div>
            <div className="flex sm:hidden items-center gap-1 text-xs text-muted-foreground px-1.5 py-1 rounded-md bg-muted/60" title={currentUserEmail}>
              <User className="w-3 h-3 shrink-0" />
              <span className="max-w-[80px] truncate">{currentUserEmail.split("@")[0]}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const { data } = await supabase.auth.getUser();
                  if (data.user) {
                    await (supabase as any).from("user_presence").delete().eq("user_id", data.user.id);
                  }
                } catch {}
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
            >
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full min-w-0">
          {/* Soft UI 主导航栏 — Apple Dashboard 风格 */}
          <div className="mb-8 p-1.5 bg-[#f5f0e8] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1">
              {[
                { value: "stats", label: "数据统计" },
                { value: "welcome", label: "迎宾接待" },
                { value: "media", label: "影音播放" },
                { value: "kitchen", label: "厨房事工" },
                { value: "sunday", label: "主日学" },
                { value: "events", label: "活动" },
              ].map((tab) => {
                const isActive = mainTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setMainTab(tab.value)}
                    className={cn(
                      "relative py-3 px-2 text-sm rounded-xl transition-all duration-200 ease-out cursor-pointer select-none outline-none",
                      isActive
                        ? "bg-white text-foreground font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.06)] translate-y-[-1px]"
                        : "bg-transparent text-muted-foreground font-medium hover:bg-white/60 hover:text-foreground/80 hover:translate-y-[-1px]"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset disabled={!isAdmin} className="contents">

            <TabsContent value="stats" className="space-y-8 mt-0">
        <section>
          <h2 className="font-serif text-xl mb-4">登记统计</h2>
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
        <section>
          <h2 className="font-serif text-xl mb-4">活动签到统计</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CheckinActivityCard
              title="成人主日学"
              dates={sundayCheckins.map((k) => k.checkin_date)}
              categories={sundayCheckins.map((k) => k.course_name ?? "未分类")}
              categoryLabel="本周活跃课程"
            />
            <CheckinActivityCard
              title="团契 / 小组聚会"
              dates={fellowshipCheckins.map((k) => k.checkin_date)}
              categories={fellowshipCheckins.map((k) => k.fellowship)}
              categoryLabel="本周活跃团契"
            />
          </div>
        </section>

        {/* 儿童主日学统计 */}
        <section>
          <h2 className="font-serif text-xl mb-4">儿童主日学统计</h2>
          <KidsAttendanceStats records={attendance} />
        </section>

        {/* 儿童班级报名统计 */}
        <section>
          <h2 className="font-serif text-xl mb-4">儿童班级报名统计</h2>
          <KidsEnrollmentStats classes={kidsRows} snapshots={kidsSnapshots} />
        </section>

        {/* 主日学参与统计 */}
        <section>
          <h2 className="font-serif text-xl mb-4">主日学参与统计</h2>
          <SundayParticipationStats checkins={sundayCheckins} courses={courses} />
        </section>
        {/* 饭食统计 */}
        <section>
          <h2 className="font-serif text-xl mb-4">饭食统计</h2>
          {(() => {
            const toLocalDate = (s: string) => {
              // plan_date is already 'YYYY-MM-DD' (date type)
              return s;
            };
            const todayStr = format(new Date(), "yyyy-MM-dd");
            const now = new Date();
            // Week range (Sun-Sat, local)
            const startOfWeek = new Date(now);
            startOfWeek.setHours(0, 0, 0, 0);
            startOfWeek.setDate(now.getDate() - now.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);
            // Month range
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const inRange = (s: string, a: Date, b: Date) => {
              const d = new Date(s + "T00:00:00");
              return d >= a && d < b;
            };
            const compute = (rows: MealPlan[]) => {
              const totalOrders = rows.length;
              const totalPeople = rows.reduce((s, r) => s + (r.attendees || 0), 0);
              const todayPeople = rows.filter((r) => toLocalDate(r.plan_date) === todayStr).reduce((s, r) => s + (r.attendees || 0), 0);
              const weekPeople = rows.filter((r) => inRange(r.plan_date, startOfWeek, endOfWeek)).reduce((s, r) => s + (r.attendees || 0), 0);
              const monthPeople = rows.filter((r) => inRange(r.plan_date, startOfMonth, startOfNextMonth)).reduce((s, r) => s + (r.attendees || 0), 0);
              return { totalOrders, totalPeople, todayPeople, weekPeople, monthPeople };
            };
            const sundayRows = mealPlans.filter((p) => (p.category ?? "sunday") === "sunday");
            const eventRows = mealPlans.filter((p) => p.category === "event");
            const groups: Array<{ title: string; stats: ReturnType<typeof compute> }> = [
              { title: "主日订餐计划", stats: compute(sundayRows) },
              { title: "其他活动订餐计划", stats: compute(eventRows) },
            ];
            return (
              <div className="space-y-6">
                {groups.map((g) => (
                  <div key={g.title} className="bg-card border border-border/50 rounded-2xl p-6">
                    <h3 className="font-serif text-lg mb-4">{g.title}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {([
                        ["总订餐次数", g.stats.totalOrders],
                        ["总人数", g.stats.totalPeople],
                        ["今日人数", g.stats.todayPeople],
                        ["本周人数", g.stats.weekPeople],
                        ["本月人数", g.stats.monthPeople],
                      ] as Array<[string, number]>).map(([label, value]) => (
                        <div key={label} className="bg-background border border-border/50 rounded-xl p-4 shadow-sm">
                          <div className="text-xs text-muted-foreground mb-1">{label}</div>
                          <div className="text-2xl font-semibold">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
        {isSuperAdmin && (
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">管理员权限</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => { setNewUserForm({ email: "", password: "", role: "user", workerName: "" }); setNewUserOpen(true); }}>
                + 添加用户
              </Button>
              <Button size="sm" variant="outline" onClick={loadUsers} disabled={usersLoading}>
                {usersLoading ? "刷新中..." : "刷新"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            新注册用户默认为「待审核」，须由超级管理员在此分配角色后才能登录。
            <br />
            <span className="text-foreground/70">角色权限：</span>
            <span className="ml-1">超级管理员 = 可修改所有设置；</span>
            <span>管理员 = 可修改设置（不可管理用户权限与系统工具）；</span>
            <span>一般用户 = 仅可查看系统（不可修改设置）；</span>
            <span>访客 = 仅能登录 / 退出。</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-muted-foreground">
                  <th className="py-2 px-2">邮箱</th>
                  <th className="py-2 px-2">同工姓名</th>
                  <th className="py-2 px-2">服侍项目</th>
                  <th className="py-2 px-2">角色</th>
                  <th className="py-2 px-2">注册时间</th>
                  <th className="py-2 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const currentRole = u.roles.includes("super_admin")
                    ? "super_admin"
                    : u.roles.includes("admin")
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
                        {editingWorkerUserId === u.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              value={editingWorkerDraft}
                              onChange={(e) => setEditingWorkerDraft(e.target.value)}
                              placeholder="同工姓名"
                              className="h-7 text-xs w-32"
                            />
                          </div>
                        ) : (
                          <span className={u.worker_name ? "" : "text-muted-foreground/60"}>
                            {u.worker_name || "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {u.service_project || <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={isPending ? pendingRole : currentRole}
                          disabled={isProtected || (isSelf && (currentRole === "admin" || currentRole === "super_admin"))}
                          onChange={async (e) => {
                            const newRole = e.target.value as "" | "super_admin" | "admin" | "user" | "viewer";
                            if (isPending) {
                              setPendingRoleSelections((prev) => ({
                                ...prev,
                                [u.id]: (newRole || "viewer") as "super_admin" | "admin" | "user" | "viewer",
                              }));
                              return;
                            }
                            const label =
                              newRole === "super_admin" ? "超级管理员"
                              : newRole === "admin" ? "管理员"
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
                          <option value="super_admin">超级管理员</option>
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
                                chosen === "super_admin" ? "超级管理员"
                                : chosen === "admin" ? "管理员"
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
                        {editingWorkerUserId === u.id ? (
                          <>
                            <button
                              onClick={async () => {
                                try {
                                  await updateWorkerNameFn({ data: { userId: u.id, workerName: editingWorkerDraft.trim() || null } });
                                  logAction(`更新 ${u.email} 同工姓名为「${editingWorkerDraft.trim() || "(空)"}」`);
                                  toast.success("已保存");
                                  setEditingWorkerUserId(null);
                                  loadUsers();
                                } catch (e) {
                                  toast.error((e as Error).message);
                                }
                              }}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => { setEditingWorkerUserId(null); setEditingWorkerDraft(""); }}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingWorkerUserId(u.id); setEditingWorkerDraft(u.worker_name || ""); }}
                            className="text-xs text-primary hover:underline"
                          >
                            编辑
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
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      暂无用户
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}
        {isSuperAdmin && (
        <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>添加新用户</DialogTitle>
              <DialogDescription>由超级管理员直接创建账号并分配角色，新用户可立即登录。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">邮箱</Label>
                <Input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">密码 (至少 6 位)</Label>
                <Input
                  type="text"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="临时密码，可让用户登录后修改"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">同工姓名 (可选)</Label>
                <Input
                  type="text"
                  value={newUserForm.workerName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, workerName: e.target.value })}
                  placeholder="例如：张弟兄"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">角色</Label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as typeof newUserForm.role })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="super_admin">超级管理员</option>
                  <option value="admin">管理员</option>
                  <option value="user">一般用户</option>
                  <option value="viewer">访客</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNewUserOpen(false)}>取消</Button>
              <Button
                disabled={newUserSubmitting}
                onClick={async () => {
                  const email = newUserForm.email.trim();
                  if (!email) return toast.error("请输入邮箱");
                  if (newUserForm.password.length < 6) return toast.error("密码至少 6 位");
                  setNewUserSubmitting(true);
                  try {
                    await createUserFn({ data: { email, password: newUserForm.password, role: newUserForm.role, workerName: newUserForm.workerName.trim() || undefined } });
                    toast.success("用户已创建");
                    logAction(`创建用户 ${email} (角色: ${newUserForm.role})`);
                    setNewUserOpen(false);
                    loadUsers();
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setNewUserSubmitting(false);
                  }
                }}
              >
                {newUserSubmitting ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
        {isSuperAdmin && (
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">系统工具栏</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            超级管理员可用的系统级工具。日志记录管理员在本浏览器上的操作（编辑、删除、权限变更等）。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => { loadLogs(); setLogsOpen(true); }}
            >
              操作日志
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/chat" })}
            >
              聊天
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open("/signage", "_blank")}
            >
              📢 宣传栏
            </Button>
            <Button
              variant="outline"
              onClick={() => setQrLibOpen(true)}
            >
              二维码库
            </Button>
            <Button
              variant="destructive"
              onClick={() => setInitOpen(true)}
            >
              系统初始化
            </Button>
          </div>
        </section>
        )}
            </TabsContent>

            <TabsContent value="welcome" className="space-y-8 mt-0">
        {/* Chrome-style sub-tabs — 2 equal columns */}
        <div className="grid grid-cols-2 items-end gap-1 border-b border-border/60 px-2 pt-1 -mb-2">
          {[
            { v: "greet", label: "迎宾" },
            { v: "reception", label: "接待" },
          ].map((t) => {
            const active = welcomeSubTab === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setWelcomeSubTab(t.v)}
                className={cn(
                  "w-full text-center px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-t-xl border border-b-0 transition-all truncate",
                  active
                    ? "bg-card text-foreground border-border shadow-sm font-medium relative -mb-px"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {welcomeSubTab === "greet" && (
          <div className="space-y-8">
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
                    <th className="py-2 px-2">介绍</th>
                    <th className="py-2 px-2">来源</th>
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
                      <td className="py-2 px-2">
                        {formatSourceChannel(r) || "—"}
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
            const newcomerList = regs
              .filter((r) => toLocalDate(r.created_at) === attDate)
              .slice()
              .reverse();
            const faithLabel = (r: Reg) => {
              if (r.faith === "christian") return `基督徒${r.faith_years ? ` ${r.faith_years}年` : ""}`;
              if (r.faith === "seeker") return "慕道友";
              if (r.faith === "other") return `其他${r.faith_other ? `:${r.faith_other}` : ""}`;
              return "未填";
            };
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
                      const newcomerLines = newcomerList.length
                        ? `\n\n今日新人名单：\n` +
                          newcomerList
                            .map((r, i) => `${i + 1}. ${r.name}（信仰：${faithLabel(r)}）`)
                            .join("\n")
                        : "";
                      const text =
                        `【主日聚会人数统计】\n` +
                        `日期：${attDate}\n` +
                        `大堂敬拜：${w} 人\n` +
                        `儿童主日学（学生）：${s} 人\n` +
                        `儿童主日学（老师）：${t} 人\n` +
                        `今日总人数：${total} 人\n` +
                        `今日新人：${newcomers} 人` +
                        newcomerLines;
                      setAttText(text);
                      toast.success("已生成文本");
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
          </div>
        )}
        {welcomeSubTab === "reception" && (
          <div className="space-y-8">
            <HospitalityCalendarSection />
            <HospitalityRankingSection />
          </div>
        )}
            </TabsContent>

            <TabsContent value="media" className="space-y-8 mt-0">
        {/* Chrome-style sub-tabs — 4 equal columns */}
        <div className="grid grid-cols-4 items-end gap-1 border-b border-border/60 px-2 pt-1 -mb-2">
          {[
            { v: "live", label: "聚会直播" },
            { v: "screen", label: "屏幕管理" },
            { v: "ministry", label: "主日轮值" },
            { v: "messages", label: "紧急事件" },
          ].map((t) => {
            const active = mediaSubTab === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setMediaSubTab(t.v)}
                className={cn(
                  "w-full text-center px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-t-xl border border-b-0 transition-all truncate",
                  active
                    ? "bg-card text-foreground border-border shadow-sm font-medium relative -mb-px"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {mediaSubTab === "live" && (
          <section className="bg-card border border-border/50 rounded-2xl p-6 space-y-5">
            <h2 className="font-serif text-xl">聚会直播 · YouTube 直播监视器</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={youtubeUrlInput}
                onChange={(e) => setYoutubeUrlInput(e.target.value)}
                placeholder="粘贴 YouTube 直播或视频地址（支持 watch?v=、youtu.be、/live/、/embed/）"
                className="flex-1"
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => {
                    const v = youtubeUrlInput.trim();
                    setYoutubeUrl(v);
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem("admin_youtube_live_url", v);
                    }
                    if (v) toast.success("已加载直播地址"); else toast.message("已清空地址");
                  }}
                >
                  加载直播
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById("yt-live-iframe") as HTMLIFrameElement | null;
                    if (el?.requestFullscreen) el.requestFullscreen();
                    else toast.error("当前浏览器不支持全屏");
                  }}
                >
                  全屏监看
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById("yt-live-iframe") as HTMLIFrameElement | null;
                    if (el) el.src = el.src;
                  }}
                >
                  刷新画面
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setYoutubeUrlInput("");
                    setYoutubeUrl("");
                    if (typeof window !== "undefined") {
                      window.localStorage.removeItem("admin_youtube_live_url");
                    }
                    toast.message("已清空地址");
                  }}
                >
                  清空地址
                </Button>
              </div>
            </div>

            {youtubeVideoId ? (
              <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-black">
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  <iframe
                    id="yt-live-iframe"
                    src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
                    title="YouTube 直播监视器"
                    className="absolute inset-0 w-full h-full"
                    style={{ minHeight: 320 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-[#f5f0e8] p-8 text-center text-foreground/80">
                请粘贴 YouTube 直播地址，开始监看聚会直播。
              </div>
            )}

            <p className="text-sm text-muted-foreground break-all">
              当前保存的直播地址：{youtubeUrl || "（未设置）"}
            </p>
          </section>
        )}

        {mediaSubTab === "screen" && (
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
          </div>
        </section>
        )}

        {mediaSubTab === "screen" && <ScreenManager />}

        {mediaSubTab === "ministry" && (
          <div className="pt-6 md:pt-8 lg:pt-10">
            <DutyCalendarSection />
          </div>
        )}


        {mediaSubTab === "messages" && (
          <div className="pt-6 md:pt-8">
            <AVMinistryWorkspace />
          </div>
        )}
            </TabsContent>

            <TabsContent value="kitchen" className="space-y-8 mt-0">
        {/* Chrome-style sub-tabs — 4 equal columns */}
        <div className="grid grid-cols-4 items-end gap-1 border-b border-border/60 px-2 pt-1 -mb-2">
          {[
            { v: "dining", label: "就餐人数统计" },
            { v: "sunday-meal", label: "主日订餐计划" },
            { v: "event-meal", label: "其他活动订餐记事本" },
            { v: "messages", label: "事工服侍" },
          ].map((t) => {
            const active = kitchenSubTab === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setKitchenSubTab(t.v)}
                className={cn(
                  "w-full text-center px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-t-xl border border-b-0 transition-all truncate",
                  active
                    ? "bg-card text-foreground border-border shadow-sm font-medium relative -mb-px"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {kitchenSubTab === "dining" && (() => {
          const toLocalDate = (iso: string) => {
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          };
          const newcomersByDate: Record<string, number> = {};
          for (const r of regs) {
            const k = toLocalDate(r.created_at);
            newcomersByDate[k] = (newcomersByDate[k] || 0) + 1;
          }
          return (
            <section className="bg-card border border-border/50 rounded-2xl p-6">
              <h2 className="font-serif text-xl mb-4">就餐人数统计</h2>
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-muted/80">
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 px-3 border border-border/60">日期</th>
                      <th className="py-2 px-3 border border-border/60">大堂</th>
                      <th className="py-2 px-3 border border-border/60">儿童学生</th>
                      <th className="py-2 px-3 border border-border/60">儿童老师</th>
                      <th className="py-2 px-3 border border-border/60">今日新人</th>
                      <th className="py-2 px-3 border border-border/60">总人数</th>
                      <th className="py-2 px-3 border border-border/60 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => {
                      const tot = a.worship_count + a.children_students + a.children_teachers;
                      const nc = newcomersByDate[a.record_date] || 0;
                      return (
                        <tr
                          key={a.id}
                          className="border-b border-border/30 hover:bg-muted/40 cursor-pointer"
                          onClick={() => setKitchenDetailRow(a)}
                        >
                          <td className="py-2 px-3 border border-border/40 whitespace-nowrap">{a.record_date}</td>
                          <td className="py-2 px-3 border border-border/40">{a.worship_count}</td>
                          <td className="py-2 px-3 border border-border/40">{a.children_students}</td>
                          <td className="py-2 px-3 border border-border/40">{a.children_teachers}</td>
                          <td className="py-2 px-3 border border-border/40 text-primary">{nc}</td>
                          <td className="py-2 px-3 border border-border/40 font-medium">{tot}</td>
                          <td className="py-2 px-3 border border-border/40 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setKitchenDetailRow(a);
                              }}
                            >
                              查看
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {attendance.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground border border-border/40">
                          暂无人数统计记录
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}

        {kitchenSubTab === "sunday-meal" && (
          <MealPlanCalendar category="sunday" title="主日订餐计划" />
        )}

        {kitchenSubTab === "event-meal" && (
          <EventMealNotebook />
        )}

        {kitchenSubTab === "messages" && (
          <div className="pt-2"><MinistryServiceCalendar /></div>
        )}

        {/* 就餐人数统计 - 详情弹窗 */}
        <Dialog open={!!kitchenDetailRow} onOpenChange={(o) => !o && setKitchenDetailRow(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>详情</DialogTitle>
            </DialogHeader>
            {kitchenDetailRow && (() => {
              const a = kitchenDetailRow;
              const toLocalDate = (iso: string) => {
                const d = new Date(iso);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              };
              const nc = regs.filter((r) => toLocalDate(r.created_at) === a.record_date).length;
              const tot = a.worship_count + a.children_students + a.children_teachers;
              const rows: [string, string | number][] = [
                ["日期", a.record_date],
                ["大堂", a.worship_count],
                ["儿童学生", a.children_students],
                ["儿童老师", a.children_teachers],
                ["今日新人", nc],
                ["总人数（大堂 + 儿童学生 + 儿童老师）", tot],
              ];
              return (
                <div className="overflow-x-auto rounded-md border border-border/60">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-muted/80">
                      <tr>
                        <th className="py-2 px-3 border border-border/60 text-left w-1/2">字段</th>
                        <th className="py-2 px-3 border border-border/60 text-left">数值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([k, v]) => (
                        <tr key={k} className="odd:bg-muted/20">
                          <td className="py-2 px-3 border border-border/40 font-medium">{k}</td>
                          <td className="py-2 px-3 border border-border/40">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
            </TabsContent>

            <TabsContent value="sunday" className="space-y-8 mt-0">
        {/* Chrome-style sub-tabs — 2 equal columns */}
        <div className="grid grid-cols-2 items-end gap-1 border-b border-border/60 px-2 pt-1 -mb-2">
          {[
            { v: "adult", label: "成人主日学" },
            { v: "kids", label: "儿童主日学" },
          ].map((t) => {
            const active = sundaySubTab === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setSundaySubTab(t.v)}
                className={cn(
                  "w-full text-center px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-t-xl border border-b-0 transition-all truncate",
                  active
                    ? "bg-card text-foreground border-border shadow-sm font-medium relative -mb-px"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {sundaySubTab === "adult" && (<>
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-xl">成人主日学</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
              <p className="font-medium">主日学签到</p>
              {publicBase && (
                <QRCodeSVG value={`${publicBase}/sunday-checkin`} size={200} level="H" />
              )}
              <p className="text-xs text-muted-foreground break-all text-center">
                {publicBase}/sunday-checkin
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${publicBase}/sunday-checkin`);
                    toast.success("链接已复制");
                  }}
                >
                  复制链接
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const url = `${publicBase}/sunday-checkin`;
                    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}`;
                    const html = `<!doctype html><html><head><meta charset="utf-8"><title>主日学签到</title>
<style>body{font-family:system-ui,sans-serif;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;}
h1{font-size:28px;margin:0 0 16px;}p{color:#555;margin:16px 0 0;font-size:14px;word-break:break-all;text-align:center;max-width:520px;}
img{width:480px;height:480px;}@media print{@page{margin:1cm;}}</style></head>
<body><h1>主日学签到</h1><img src="${qrSrc}" alt="QR"/><p>${url}</p>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script></body></html>`;
                    const w = window.open("", "_blank");
                    if (!w) { toast.error("浏览器拦截了弹窗"); return; }
                    w.document.open(); w.document.write(html); w.document.close();
                  }}
                >
                  打印二维码
                </Button>
              </div>
            </div>
            <div className="border border-border/50 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium">已开放课程</p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setCoursesOpen(true)}
                  >
                    ⚙ 设置
                  </Button>
                </div>
              </div>
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无课程，请点击右上角「设置」添加。</p>
              ) : (
                <ul className="text-sm space-y-1.5">
                  {courses.filter((c) => c.is_active).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground">·</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs shrink-0"
                        onClick={() =>
                          window.open(
                            `/sunday-schedule?courseId=${c.id}&courseName=${encodeURIComponent(c.name)}`,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        课程表
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-xl">课程签到记录</h2>
            <div className="flex flex-wrap items-center gap-2">
              <MonthRangePicker
                start={courseRange.start}
                end={courseRange.end}
                onChange={(s, e) => setCourseRange({ start: s, end: e })}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const inRange = (d: string) => {
                    const ym = (d ?? "").slice(0, 7);
                    return ym >= courseRange.start && ym <= courseRange.end;
                  };
                  const activeCourses = courses.filter((c) => c.is_active);
                  const rows = sundayCheckins
                    .filter((k) => inRange(k.checkin_date ?? ""))
                    .map((k) => ({
                      课程: activeCourses.find((c) => c.id === k.course_id)?.name ?? k.course_name ?? "",
                      日期: k.checkin_date,
                      姓名: k.name,
                      "电话/微信": k.contact ?? "",
                      邮件: k.email ?? "",
                    }));
                  if (rows.length === 0) { toast.error("当前范围无记录"); return; }
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "课程签到");
                  XLSX.writeFile(wb, `课程签到记录_${courseRange.start}至${courseRange.end}.xlsx`);
                }}
              >
                导出 Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => loadSundayCheckins()}>
                刷新
              </Button>
            </div>
          </div>
          {courses.filter((c) => c.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无课程。添加课程后此处会自动生成标签页。</p>
          ) : (
            <Tabs
              value={activeCourseTab || courses.find((c) => c.is_active)?.id || ""}
              onValueChange={setActiveCourseTab}
              className="w-full"
            >
              {/* Chrome风格自定义Tab Bar */}
              <div className="flex flex-wrap relative" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {courses.filter((c) => c.is_active).map((c) => {
                  const count = sundayCheckins.filter((k) => {
                    if (k.course_id !== c.id) return false;
                    const ym = (k.checkin_date ?? "").slice(0, 7);
                    return ym >= courseRange.start && ym <= courseRange.end;
                  }).length;
                  const currentTab = activeCourseTab || courses.find((c2) => c2.is_active)?.id || "";
                  const isActive = currentTab === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCourseTab(c.id)}
                      className={cn(
                        "relative px-3 py-2 text-xs transition-all duration-150 cursor-pointer select-none outline-none mr-1",
                        isActive
                          ? "bg-white text-foreground font-semibold"
                          : "bg-[#f5f0e8] text-muted-foreground hover:bg-[#ede8dc] hover:text-foreground/80"
                      )}
                      style={isActive ? {
                        borderRadius: '8px 8px 0 0',
                        boxShadow: '0 -2px 6px rgba(0,0,0,0.06), 2px 0 4px rgba(0,0,0,0.02), -2px 0 4px rgba(0,0,0,0.02)',
                        borderTop: '1px solid rgba(0,0,0,0.08)',
                        borderLeft: '1px solid rgba(0,0,0,0.08)',
                        borderRight: '1px solid rgba(0,0,0,0.08)',
                        borderBottom: '1px solid white',
                        marginBottom: '-1px',
                        zIndex: 2,
                      } : {
                        borderRadius: '6px 6px 0 0',
                        border: '1px solid transparent',
                        borderBottom: 'none',
                      }}
                    >
                      {c.name} ({count})
                    </button>
                  );
                })}
              </div>
              {courses.filter((c) => c.is_active).map((c) => {
                const rows = sundayCheckins.filter((k) => {
                  if (k.course_id !== c.id) return false;
                  const ym = (k.checkin_date ?? "").slice(0, 7);
                  return ym >= courseRange.start && ym <= courseRange.end;
                });
                const pg = coursePages[c.id] ?? 1;
                const totalPg = Math.max(1, Math.ceil(rows.length / TAB_PAGE_SIZE));
                const slice = rows.slice((pg - 1) * TAB_PAGE_SIZE, pg * TAB_PAGE_SIZE);
                return (
                  <TabsContent key={c.id} value={c.id} className="mt-4">
                    <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-lg border border-border/50">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                          <tr className="text-left border-b border-border/60 text-muted-foreground">
                            <th className="py-2 px-2">日期</th>
                            <th className="py-2 px-2">姓名</th>
                            <th className="py-2 px-2">电话/微信</th>
                            <th className="py-2 px-2">邮件</th>
                            <th className="py-2 px-2 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slice.map((k) => (
                            <tr key={k.id} className="border-b border-border/30">
                              <td className="py-2 px-2 whitespace-nowrap">{k.checkin_date}</td>
                              <td className="py-2 px-2 font-medium">{k.name}</td>
                              <td className="py-2 px-2">{k.contact ?? ""}</td>
                              <td className="py-2 px-2">{k.email ?? ""}</td>
                              <td className="py-2 px-2 text-right">
                                <button
                                  onClick={async () => {
                                    if (!confirm(`删除 ${k.name} 的签到?`)) return;
                                    const { error } = await supabase
                                      .from("sunday_school_checkins")
                                      .delete()
                                      .eq("id", k.id);
                                    if (error) return toast.error(error.message);
                                    logAction(`删除主日学签到: ${k.name}`);
                                    toast.success("已删除");
                                    loadSundayCheckins();
                                  }}
                                  className="text-xs text-destructive hover:underline"
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                暂无签到记录
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {totalPg > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                        <Button size="sm" variant="outline" disabled={pg === 1} onClick={() => setCoursePages({ ...coursePages, [c.id]: pg - 1 })}>上一页</Button>
                        <span>{pg} / {totalPg}</span>
                        <Button size="sm" variant="outline" disabled={pg === totalPg} onClick={() => setCoursePages({ ...coursePages, [c.id]: pg + 1 })}>下一页</Button>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </section>
        {/* 团契签到记录 - moved under 主日学 → 成人 */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-xl">团契签到记录</h2>
            <div className="flex flex-wrap items-center gap-2">
              <DateLevelPicker value={fellowshipFilter} onChange={setFellowshipFilter} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const { year, month, day } = fellowshipFilter;
                  const match = (d: string) => {
                    if (!d) return false;
                    if (d.slice(0, 4) !== String(year)) return false;
                    if (month !== null && d.slice(5, 7) !== _pad2(month)) return false;
                    if (day !== null && d.slice(8, 10) !== _pad2(day)) return false;
                    return true;
                  };
                  const rows = fellowshipCheckins
                    .filter((k) => match(k.checkin_date ?? ""))
                    .map((k) => ({
                      团契: k.fellowship,
                      日期: k.checkin_date,
                      姓名: k.name,
                      "电话/微信": k.contact ?? "",
                      邮件: k.email ?? "",
                      代祷备注: k.prayer_request ?? "",
                    }));
                  if (rows.length === 0) { toast.error("当前范围无记录"); return; }
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "团契签到");
                  let suffix = String(year);
                  if (month !== null) suffix += `-${_pad2(month)}`;
                  if (day !== null) suffix += `-${_pad2(day)}`;
                  XLSX.writeFile(wb, `团契签到记录_${suffix}.xlsx`);
                }}
              >
                导出 Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => loadFellowshipCheckins()}>
                刷新
              </Button>
            </div>
          </div>
          {fellowships.filter((f) => f.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无团契。请在「主日学」页右上角「团契 / 小组设置」中添加。</p>
          ) : (
            <Tabs
              value={activeFellowshipTab || fellowships.find((f) => f.is_active)?.id || ""}
              onValueChange={setActiveFellowshipTab}
              className="w-full"
            >
              <TabsList className="h-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-[#f5f0e8]/60 p-2 rounded-xl">
                {fellowships.filter((f) => f.is_active).map((f) => {
                  const matchDate = (d: string) => {
                    if (!d) return false;
                    if (d.slice(0, 4) !== String(fellowshipFilter.year)) return false;
                    if (fellowshipFilter.month !== null && d.slice(5, 7) !== _pad2(fellowshipFilter.month)) return false;
                    if (fellowshipFilter.day !== null && d.slice(8, 10) !== _pad2(fellowshipFilter.day)) return false;
                    return true;
                  };
                  const count = fellowshipCheckins.filter(
                    (k) => k.fellowship === f.name && matchDate(k.checkin_date ?? ""),
                  ).length;
                  return (
                    <TabsTrigger
                      key={f.id}
                      value={f.id}
                      className="w-full justify-center text-xs sm:text-sm py-2 px-3 rounded-lg whitespace-normal text-center leading-tight bg-background/60 hover:bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="ml-1 opacity-70">({count})</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {fellowships.filter((f) => f.is_active).map((f) => {
                const matchDate = (d: string) => {
                  if (!d) return false;
                  if (d.slice(0, 4) !== String(fellowshipFilter.year)) return false;
                  if (fellowshipFilter.month !== null && d.slice(5, 7) !== _pad2(fellowshipFilter.month)) return false;
                  if (fellowshipFilter.day !== null && d.slice(8, 10) !== _pad2(fellowshipFilter.day)) return false;
                  return true;
                };
                const rows = fellowshipCheckins.filter(
                  (k) => k.fellowship === f.name && matchDate(k.checkin_date ?? ""),
                );
                const pg = fellowshipPages[f.id] ?? 1;
                const totalPg = Math.max(1, Math.ceil(rows.length / TAB_PAGE_SIZE));
                const slice = rows.slice((pg - 1) * TAB_PAGE_SIZE, pg * TAB_PAGE_SIZE);
                return (
                  <TabsContent key={f.id} value={f.id} className="mt-4">
                    <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-lg border border-border/50">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                          <tr className="text-left border-b border-border/60 text-muted-foreground">
                            <th className="py-2 px-2">日期</th>
                            <th className="py-2 px-2">姓名</th>
                            <th className="py-2 px-2">电话/微信</th>
                            <th className="py-2 px-2">邮件</th>
                            <th className="py-2 px-2">代祷备注</th>
                            <th className="py-2 px-2 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slice.map((k) => (
                            <tr key={k.id} className="border-b border-border/30 align-top">
                              <td className="py-2 px-2 whitespace-nowrap">{k.checkin_date}</td>
                              <td className="py-2 px-2 font-medium">{k.name}</td>
                              <td className="py-2 px-2">{k.contact ?? ""}</td>
                              <td className="py-2 px-2">{k.email ?? ""}</td>
                              <td className="py-2 px-2 max-w-[260px] whitespace-pre-wrap break-words">{k.prayer_request ?? ""}</td>
                              <td className="py-2 px-2 text-right">
                                <button
                                  onClick={async () => {
                                    if (!confirm(`删除 ${k.name} 的签到?`)) return;
                                    const { error } = await supabase
                                      .from("fellowship_checkins")
                                      .delete()
                                      .eq("id", k.id);
                                    if (error) return toast.error(error.message);
                                    logAction(`删除团契签到: ${k.name}`);
                                    toast.success("已删除");
                                    loadFellowshipCheckins();
                                  }}
                                  className="text-xs text-destructive hover:underline"
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                暂无签到记录
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {totalPg > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                        <Button size="sm" variant="outline" disabled={pg === 1} onClick={() => setFellowshipPages({ ...fellowshipPages, [f.id]: pg - 1 })}>上一页</Button>
                        <span>{pg} / {totalPg}</span>
                        <Button size="sm" variant="outline" disabled={pg === totalPg} onClick={() => setFellowshipPages({ ...fellowshipPages, [f.id]: pg + 1 })}>下一页</Button>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </section>
        {(["summer","fall"] as const).map((kind) => {
          const title = kind === "summer" ? "暑期成人主日学签到" : "秋季成人主日学签到";
          const yearAll = adultCheckins.filter((c) => c.kind === kind);
          const yr = adultYearFilter[kind];
          const all = yearAll.filter((c) => new Date(c.checkin_at).getFullYear() === yr);
          const dateFilter = adultDateFilter[kind];
          const filtered = dateFilter
            ? all.filter((c) => {
                const d = new Date(c.checkin_at);
                return d.getFullYear() === dateFilter.getFullYear()
                  && d.getMonth() === dateFilter.getMonth()
                  && d.getDate() === dateFilter.getDate();
              })
            : all;
          const sort = adultSort[kind];
          const sorted = [...filtered].sort((a, b) => {
            const av = sort.col === "name" ? a.name : sort.col === "fellowship" ? (a.fellowship ?? "") : a.checkin_at;
            const bv = sort.col === "name" ? b.name : sort.col === "fellowship" ? (b.fellowship ?? "") : b.checkin_at;
            const cmp = String(av).localeCompare(String(bv), "zh-CN");
            return sort.dir === "asc" ? cmp : -cmp;
          });
          const pg = adultPages[kind] ?? 1;
          const totalPg = Math.max(1, Math.ceil(sorted.length / ADULT_PAGE_SIZE));
          const slice = sorted.slice((pg - 1) * ADULT_PAGE_SIZE, pg * ADULT_PAGE_SIZE);
          const toggleSort = (col: "name" | "fellowship" | "time") => {
            setAdultSort((prev) => ({
              ...prev,
              [kind]: prev[kind].col === col
                ? { col, dir: prev[kind].dir === "asc" ? "desc" : "asc" }
                : { col, dir: "asc" },
            }));
            setAdultPages((p) => ({ ...p, [kind]: 1 }));
          };
          const arrow = (col: "name" | "fellowship" | "time") => sort.col === col ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
          const exportAdult = (rowsToExport: AdultCheckin[], suffix: string) => {
            if (rowsToExport.length === 0) return toast.error("无数据可导出");
            const data = rowsToExport.map((r, i) => ({
              "序号": i + 1,
              "签到时间": new Date(r.checkin_at).toLocaleString("zh-CN", { hour12: false }),
              "姓名": r.name,
              "团契": r.fellowship ?? "",
              "备注": r.notes ?? "",
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            ws["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "签到名单");
            XLSX.writeFile(wb, `${title}_${suffix}_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast.success(`已导出 ${data.length} 条`);
          };
          return (
            <section key={kind} className="bg-card border border-border/50 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-serif text-xl">{title}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <YearFilterPicker
                    value={yr}
                    onChange={(y) => {
                      setAdultYearFilter((p) => ({ ...p, [kind]: y }));
                      setAdultPages((p) => ({ ...p, [kind]: 1 }));
                    }}
                  />
                  <Popover open={adultDateOpen[kind]} onOpenChange={(v) => setAdultDateOpen((p) => ({ ...p, [kind]: v }))}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {dateFilter ? format(dateFilter, "yyyy-MM-dd") : "日期筛选"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={dateFilter}
                        onSelect={(d) => {
                          setAdultDateFilter((p) => ({ ...p, [kind]: d ?? undefined }));
                          setAdultPages((p) => ({ ...p, [kind]: 1 }));
                          setAdultDateOpen((p) => ({ ...p, [kind]: false }));
                        }}
                        locale={zhCN}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {dateFilter && (
                    <Button size="sm" variant="ghost" onClick={() => setAdultDateFilter((p) => ({ ...p, [kind]: undefined }))}>
                      清除
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => exportAdult(sorted, dateFilter ? format(dateFilter, "yyyy-MM-dd") : "当前")}>
                    导出当前
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportAdult(all, "全部")}>
                    所有名单 · 导出 Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadAdultCheckins()}>刷新</Button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-border/50">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                    <tr className="text-left border-b border-border/60 text-muted-foreground">
                      <th className="py-2 px-2 cursor-pointer select-none" onClick={() => toggleSort("time")}>当前时间{arrow("time")}</th>
                      <th className="py-2 px-2 cursor-pointer select-none" onClick={() => toggleSort("name")}>姓名{arrow("name")}</th>
                      <th className="py-2 px-2 cursor-pointer select-none" onClick={() => toggleSort("fellowship")}>团契{arrow("fellowship")}</th>
                      <th className="py-2 px-2">备注</th>
                      <th className="py-2 px-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((k) => (
                      <tr key={k.id} className="border-b border-border/30 align-top">
                        <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                          {new Date(k.checkin_at).toLocaleString("zh-CN", { hour12: false })}
                        </td>
                        <td className="py-2 px-2 font-medium">{k.name}</td>
                        <td className="py-2 px-2">{k.fellowship ?? ""}</td>
                        <td className="py-2 px-2 max-w-[260px] whitespace-pre-wrap break-words">{k.notes ?? ""}</td>
                        <td className="py-2 px-2 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm(`删除 ${k.name} 的签到?`)) return;
                              const { error } = await (supabase as any).from("adult_class_checkins").delete().eq("id", k.id);
                              if (error) return toast.error(error.message);
                              toast.success("已删除");
                              loadAdultCheckins();
                            }}
                            className="text-xs text-destructive hover:underline"
                          >删除</button>
                        </td>
                      </tr>
                    ))}
                    {sorted.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">暂无签到记录</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPg > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                  <Button size="sm" variant="outline" disabled={pg === 1} onClick={() => setAdultPages({ ...adultPages, [kind]: pg - 1 })}>上一页</Button>
                  <span>{pg} / {totalPg}</span>
                  <Button size="sm" variant="outline" disabled={pg === totalPg} onClick={() => setAdultPages({ ...adultPages, [kind]: pg + 1 })}>下一页</Button>
                </div>
              )}
            </section>
          );
        })}
        </>)}

        {sundaySubTab === "kids" && (<>
        {/* 儿童主日学 */}
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-2xl mb-4">儿童主日学</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {(["spring","fall"] as const).map((season) => {
              const cfg = KIDS_TRACKS[season];
              const titleKey = `${cfg.key}_title`;
              const title = appSettings[titleKey] || cfg.title;
              const rows = kidsRows.filter((r) => r.track === cfg.key);
              const exportKids = () => {
                if (rows.length === 0) return toast.error("无数据可导出");
                const data = rows.map((r, i) => ({
                  "序号": i + 1,
                  "班级": r.class_name ?? "",
                  "老师": r.teacher_name ?? "",
                  "地点": r.class_location ?? "",
                  "人数": r.student_count ?? 0,
                }));
                const ws = XLSX.utils.json_to_sheet(data);
                ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 8 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "儿童主日学");
                XLSX.writeFile(wb, `${title}_${new Date().toISOString().slice(0,10)}.xlsx`);
                toast.success(`已导出 ${data.length} 条`);
              };
              const importKids = async (file: File) => {
                try {
                  const buf = await file.arrayBuffer();
                  const wb = XLSX.read(buf, { type: "array" });
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
                  if (json.length === 0) return toast.error("文件为空");
                  const baseOrder = rows[rows.length - 1]?.sort_order ?? 0;
                  const inserts = json.map((r, idx) => {
                    const get = (keys: string[]) => {
                      for (const k of keys) {
                        if (r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
                      }
                      return null;
                    };
                    return {
                      track: cfg.key,
                      slot_time: "",
                      class_name: get(["班级", "class", "class_name"]),
                      teacher_name: get(["老师", "teacher", "teacher_name"]),
                      class_location: get(["地点", "location", "class_location"]),
                      student_count: (() => {
                        const raw = get(["人数", "count", "student_count"]);
                        const n = raw ? parseInt(raw, 10) : 0;
                        return isNaN(n) ? 0 : Math.max(0, n);
                      })(),
                      sort_order: baseOrder + idx + 1,
                    };
                  }).filter((r) => r.class_name || r.teacher_name || r.class_location);
                  if (inserts.length === 0) return toast.error("未识别到有效数据");
                  const { error } = await (supabase as any).from("sunday_class_schedule").insert(inserts);
                  if (error) return toast.error(error.message);
                  toast.success(`已导入 ${inserts.length} 条`);
                  loadKidsRows();
                } catch (err) {
                  toast.error("导入失败: " + (err as Error).message);
                }
              };
              const printKids = () => {
                const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:24px;}
h1{font-size:20px;margin:0 0 16px;}table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #888;padding:8px 10px;text-align:left;font-size:14px;}
th{background:#f4f4f5;}</style></head><body>
<h1>${title}</h1>
<table><thead><tr><th style="width:60px">序号</th><th>班级</th><th>老师</th><th>地点</th><th style="width:70px">人数</th></tr></thead>
<tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.class_name??""}</td><td>${r.teacher_name??""}</td><td>${r.class_location??""}</td><td>${r.student_count??0}</td></tr>`).join("")}
${rows.length===0?'<tr><td colspan="5" style="text-align:center;color:#888;padding:24px">暂无数据</td></tr>':""}
</tbody></table>
<script>window.onload=()=>{setTimeout(()=>window.print(),200);}</script>
</body></html>`;
                const w = window.open("", "_blank", "width=900,height=700");
                if (!w) return toast.error("请允许弹出窗口");
                w.document.write(html); w.document.close();
              };
              return (
                <div key={season} className="border border-border/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-serif text-lg">{title}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground h-7 px-2"
                      onClick={() => { setKidsNewTeacher(""); setKidsSettingsSeason(season); }}
                    >
                      ⚙ 设置
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border/50 mb-3">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/80">
                        <tr className="text-left border-b border-border/60 text-muted-foreground">
                          <th className="py-2 px-2 w-1/3">班级</th>
                          <th className="py-2 px-2 w-1/3">老师</th>
                          <th className="py-2 px-2">地点</th>
                          <th className="py-2 px-2 w-20">人数</th>
                          <th className="py-2 px-2 text-right w-16">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className="border-b border-border/30">
                            <td className="py-2 px-2">
                              <Input
                                defaultValue={r.class_name ?? ""}
                                className="h-8"
                                onBlur={async (e) => {
                                  const v = e.target.value;
                                  if (v === (r.class_name ?? "")) return;
                                  await (supabase as any).from("sunday_class_schedule").update({ class_name: v || null }).eq("id", r.id);
                                  loadKidsRows();
                                }}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                defaultValue={r.teacher_name ?? ""}
                                className="h-8"
                                list={`kids-teachers-${season}`}
                                onBlur={async (e) => {
                                  const v = e.target.value;
                                  if (v === (r.teacher_name ?? "")) return;
                                  await (supabase as any).from("sunday_class_schedule").update({ teacher_name: v || null }).eq("id", r.id);
                                  loadKidsRows();
                                }}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                defaultValue={r.class_location ?? ""}
                                className="h-8"
                                onBlur={async (e) => {
                                  const v = e.target.value;
                                  if (v === (r.class_location ?? "")) return;
                                  await (supabase as any).from("sunday_class_schedule").update({ class_location: v || null }).eq("id", r.id);
                                  loadKidsRows();
                                }}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                min={0}
                                defaultValue={String(r.student_count ?? 0)}
                                className="h-8 w-20"
                                onBlur={async (e) => {
                                  const n = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
                                  if (n === (r.student_count ?? 0)) return;
                                  const { error: upErr } = await (supabase as any)
                                    .from("sunday_class_schedule")
                                    .update({ student_count: n })
                                    .eq("id", r.id);
                                  if (upErr) { toast.error(upErr.message); return; }
                                  // 同时写入今日快照（按 class_id + snapshot_date 唯一）
                                  const today = new Date();
                                  const y = today.getFullYear();
                                  const m = String(today.getMonth() + 1).padStart(2, "0");
                                  const d = String(today.getDate()).padStart(2, "0");
                                  const snapshot_date = `${y}-${m}-${d}`;
                                  await (supabase as any)
                                    .from("kids_class_enrollment_snapshots")
                                    .upsert(
                                      {
                                        class_id: r.id,
                                        track: r.track,
                                        class_name: r.class_name,
                                        student_count: n,
                                        snapshot_date,
                                      },
                                      { onConflict: "class_id,snapshot_date" },
                                    );
                                  loadKidsRows();
                                  loadKidsSnapshots();
                                }}
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <button
                                className="text-xs text-destructive hover:underline"
                                onClick={async () => {
                                  if (!confirm("删除该行?")) return;
                                  await (supabase as any).from("sunday_class_schedule").delete().eq("id", r.id);
                                  loadKidsRows();
                                }}
                              >删除</button>
                            </td>
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">暂无记录</td></tr>
                        )}
                      </tbody>
                    </table>
                    <datalist id={`kids-teachers-${season}`}>
                      {sundayTeachers.filter((t) => t.is_active).map((t) => (
                        <option key={t.id} value={t.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        const next = (rows[rows.length - 1]?.sort_order ?? 0) + 1;
                        const { error } = await (supabase as any).from("sunday_class_schedule").insert({
                          track: cfg.key, slot_time: "", class_name: "", teacher_name: "", class_location: "", sort_order: next,
                        });
                        if (error) return toast.error(error.message);
                        loadKidsRows();
                      }}
                    >
                      + 添加课程
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportKids}>导出 Excel</Button>
                    <label className="inline-flex">
                      <input type="file" accept=".xlsx,.xls" hidden onChange={(e) => {
                        const f = e.target.files?.[0]; if (f) importKids(f); e.target.value = "";
                      }} />
                      <Button asChild size="sm" variant="outline">
                        <span className="cursor-pointer">导入 Excel</span>
                      </Button>
                    </label>
                    <Button size="sm" variant="outline" onClick={printKids}>打印</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        </>)}
            </TabsContent>

            <TabsContent value="events" className="space-y-8 mt-0">
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <h2 className="font-serif text-xl">教会活动</h2>
          </div>
          {/* 成人主日学扫码签到 */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {(["summer","fall"] as const).map((k) => {
              const label = k === "summer" ? "暑期成人主日学" : "秋季成人主日学";
              const url = `${publicBase}/adult-checkin/${k}`;
              return (
                <div key={k} className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
                  <p className="font-medium">{label} · 扫码签到</p>
                  {publicBase && <QRCodeSVG value={url} size={180} level="H" />}
                  <p className="text-xs text-muted-foreground break-all text-center">{url}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("链接已复制"); }}>
                      复制链接
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                      打开
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {events.map((ev) => {
              const url = `${publicBase}/register?event=${ev.qr_token}`;
              return (
                <div key={ev.id} className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
                  <p className="font-medium text-center">{ev.name}</p>
                  {publicBase && <QRCodeSVG value={url} size={180} level="H" />}
                  <p className="text-xs text-muted-foreground break-all text-center">{url}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">状态:</span>
                    {ev.is_active ? (
                      <span className="font-medium text-green-600">二维码工作中</span>
                    ) : (
                      <span className="font-medium text-foreground">二维码已停用</span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("链接已复制"); }}>
                      复制链接
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                      打开
                    </Button>
                    <Button size="sm" onClick={addEvent}>生成新二维码</Button>
                  </div>
                </div>
              );
            })}
            {/* 退修会登记 — 与新人登记并排 */}
            <div className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
              <p className="font-medium text-center">退修会登记</p>
              {publicBase && <QRCodeSVG value={`${publicBase}/retreat`} size={180} level="H" />}
              <p className="text-xs text-muted-foreground break-all text-center">{publicBase}/retreat</p>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${publicBase}/retreat`); toast.success("链接已复制"); }}>
                  复制链接
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open("/retreat", "_blank", "noopener,noreferrer")}>
                  打开
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-xl mb-4">教会服侍</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {/* 服侍申请 QR */}
            <div className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
              <p className="font-medium">服侍申请</p>
              {publicBase && (
                <QRCodeSVG value={`${publicBase}/serve-apply`} size={180} level="H" />
              )}
              <p className="text-xs text-muted-foreground break-all text-center">{publicBase}/serve-apply</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${publicBase}/serve-apply`);
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
              {publicBase && (
                <QRCodeSVG value={`${publicBase}/feedback`} size={180} level="H" />
              )}
              <p className="text-xs text-muted-foreground break-all text-center">{publicBase}/feedback</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${publicBase}/feedback`);
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-xl">团契 / 小组聚会签到</h2>
            <Button size="sm" variant="outline" onClick={() => setFellowshipsOpen(true)}>
              团契 / 小组设置
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3">
              <p className="font-medium">团契 / 小组聚会签到</p>
              {publicBase && (
                <QRCodeSVG value={`${publicBase}/fellowship-checkin`} size={200} level="H" />
              )}
              <p className="text-xs text-muted-foreground break-all text-center">
                {publicBase}/fellowship-checkin
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${publicBase}/fellowship-checkin`);
                    toast.success("链接已复制");
                  }}
                >
                  复制链接
                </Button>
              </div>
            </div>
            <div className="border border-border/50 rounded-xl p-4 flex flex-col gap-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">说明</p>
              <p>扫码后参加者填写：日期、姓名、电话/微信、邮件、所属团契，以及代祷备注。</p>
              <p>表单同时显示中英文，方便弟兄姐妹使用。</p>
            </div>
          </div>
        </section>

            </TabsContent>

          </fieldset>
        </Tabs>

        {/* 主日学课程设置 Dialog */}
        <Dialog open={coursesOpen} onOpenChange={setCoursesOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>主日学课程设置</DialogTitle>
            </DialogHeader>
            <Tabs value={courseSettingsTab} onValueChange={(v) => setCourseSettingsTab(v as "courses" | "teachers")} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="courses">课程管理</TabsTrigger>
                <TabsTrigger value="teachers">老师管理</TabsTrigger>
              </TabsList>
              <TabsContent value="courses" className="space-y-4 mt-0">
              <div className="flex gap-2">
                <Input
                  placeholder="新课程名称"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = newCourseName.trim();
                      if (!name) return;
                      const nextOrder = (courses[courses.length - 1]?.sort_order ?? 0) + 1;
                      const { error } = await supabase
                        .from("sunday_school_courses")
                        .insert({ name, sort_order: nextOrder });
                      if (error) return toast.error(error.message);
                      setNewCourseName("");
                      logAction(`新增主日学课程: ${name}`);
                      toast.success("已添加");
                      loadCourses();
                    }
                  }}
                />
                <Button
                  onClick={async () => {
                    const name = newCourseName.trim();
                    if (!name) return toast.error("请输入课程名称");
                    const nextOrder = (courses[courses.length - 1]?.sort_order ?? 0) + 1;
                    const { error } = await supabase
                      .from("sunday_school_courses")
                      .insert({ name, sort_order: nextOrder });
                    if (error) return toast.error(error.message);
                    setNewCourseName("");
                    logAction(`新增主日学课程: ${name}`);
                    toast.success("已添加");
                    loadCourses();
                  }}
                >
                  添加
                </Button>
              </div>
              <div className="space-y-2">
                {courses.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">暂无课程</p>
                )}
                {courses.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 border border-border/50 rounded-md px-3 py-2">
                    <Input
                      defaultValue={c.name}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (!v || v === c.name) return;
                        const { error } = await supabase
                          .from("sunday_school_courses")
                          .update({ name: v })
                          .eq("id", c.id);
                        if (error) return toast.error(error.message);
                        logAction(`修改主日学课程: ${c.name} → ${v}`);
                        toast.success("已更新");
                        loadCourses();
                      }}
                      className="flex-1"
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={c.is_active}
                        onChange={async (e) => {
                          await supabase
                            .from("sunday_school_courses")
                            .update({ is_active: e.target.checked })
                            .eq("id", c.id);
                          loadCourses();
                        }}
                      />
                      启用
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`删除课程「${c.name}」?`)) return;
                        const { error } = await supabase
                          .from("sunday_school_courses")
                          .delete()
                          .eq("id", c.id);
                        if (error) return toast.error(error.message);
                        logAction(`删除主日学课程: ${c.name}`);
                        toast.success("已删除");
                        loadCourses();
                      }}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
              </TabsContent>
              <TabsContent value="teachers" className="space-y-4 mt-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="新老师姓名"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                  />
                  <Button
                    onClick={async () => {
                      const name = newTeacherName.trim();
                      if (!name) return toast.error("请输入老师姓名");
                      const nextOrder = (sundayTeachers[sundayTeachers.length - 1]?.sort_order ?? 0) + 1;
                      const { error } = await (supabase as any)
                        .from("sunday_school_teachers")
                        .insert({ name, sort_order: nextOrder });
                      if (error) return toast.error(error.message);
                      setNewTeacherName("");
                      logAction(`新增主日学老师: ${name}`);
                      toast.success("已添加");
                      loadSundayTeachers();
                    }}
                  >
                    添加
                  </Button>
                </div>
                <div className="space-y-2">
                  {sundayTeachers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">暂无老师</p>
                  )}
                  {sundayTeachers.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 border border-border/50 rounded-md px-3 py-2">
                      <Input
                        defaultValue={t.name}
                        onBlur={async (e) => {
                          const v = e.target.value.trim();
                          if (!v || v === t.name) return;
                          const { error } = await (supabase as any)
                            .from("sunday_school_teachers")
                            .update({ name: v })
                            .eq("id", t.id);
                          if (error) return toast.error(error.message);
                          logAction(`修改主日学老师: ${t.name} → ${v}`);
                          toast.success("已更新");
                          loadSundayTeachers();
                        }}
                        className="flex-1"
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={t.is_active}
                          onChange={async (e) => {
                            await (supabase as any)
                              .from("sunday_school_teachers")
                              .update({ is_active: e.target.checked })
                              .eq("id", t.id);
                            loadSundayTeachers();
                          }}
                        />
                        启用
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          if (!confirm(`删除老师「${t.name}」?`)) return;
                          const { error } = await (supabase as any)
                            .from("sunday_school_teachers")
                            .delete()
                            .eq("id", t.id);
                          if (error) return toast.error(error.message);
                          logAction(`删除主日学老师: ${t.name}`);
                          toast.success("已删除");
                          loadSundayTeachers();
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* 团契 / 小组设置 Dialog */}
        <Dialog open={fellowshipsOpen} onOpenChange={setFellowshipsOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>团契 / 小组设置</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="新团契 / 小组名称"
                  value={newFellowshipName}
                  onChange={(e) => setNewFellowshipName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = newFellowshipName.trim();
                      if (!name) return;
                      const nextOrder = (fellowships[fellowships.length - 1]?.sort_order ?? 0) + 1;
                      const { error } = await supabase
                        .from("fellowships")
                        .insert({ name, sort_order: nextOrder });
                      if (error) return toast.error(error.message);
                      setNewFellowshipName("");
                      logAction(`新增团契: ${name}`);
                      toast.success("已添加");
                      loadFellowships();
                    }
                  }}
                />
                <Button
                  onClick={async () => {
                    const name = newFellowshipName.trim();
                    if (!name) return toast.error("请输入名称");
                    const nextOrder = (fellowships[fellowships.length - 1]?.sort_order ?? 0) + 1;
                    const { error } = await supabase
                      .from("fellowships")
                      .insert({ name, sort_order: nextOrder });
                    if (error) return toast.error(error.message);
                    setNewFellowshipName("");
                    logAction(`新增团契: ${name}`);
                    toast.success("已添加");
                    loadFellowships();
                  }}
                >
                  添加
                </Button>
              </div>
              <div className="space-y-2">
                {fellowships.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">暂无团契</p>
                )}
                {fellowships.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 border border-border/50 rounded-md px-3 py-2">
                    <Input
                      defaultValue={f.name}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (!v || v === f.name) return;
                        const oldName = f.name;
                        const { error } = await supabase
                          .from("fellowships")
                          .update({ name: v })
                          .eq("id", f.id);
                        if (error) return toast.error(error.message);
                        // Keep historical checkins consistent with the new name
                        await supabase
                          .from("fellowship_checkins")
                          .update({ fellowship: v })
                          .eq("fellowship", oldName);
                        logAction(`修改团契名称: ${oldName} → ${v}`);
                        toast.success("已更新");
                        loadFellowships();
                        loadFellowshipCheckins();
                      }}
                      className="flex-1"
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={f.is_active}
                        onChange={async (e) => {
                          await supabase
                            .from("fellowships")
                            .update({ is_active: e.target.checked })
                            .eq("id", f.id);
                          loadFellowships();
                        }}
                      />
                      启用
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`删除团契「${f.name}」?`)) return;
                        const { error } = await supabase
                          .from("fellowships")
                          .delete()
                          .eq("id", f.id);
                        if (error) return toast.error(error.message);
                        logAction(`删除团契: ${f.name}`);
                        toast.success("已删除");
                        loadFellowships();
                      }}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={mealTypesOpen} onOpenChange={setMealTypesOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>饭食种类设置</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="新种类名称"
                  value={newMealTypeName}
                  onChange={(e) => setNewMealTypeName(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    const name = newMealTypeName.trim();
                    if (!name) return toast.error("请输入名称");
                    const next = (mealTypes[mealTypes.length - 1]?.sort_order ?? 0) + 1;
                    const { error } = await (supabase as any).from("meal_types").insert({ name, sort_order: next });
                    if (error) return toast.error(error.message);
                    setNewMealTypeName(""); toast.success("已添加"); loadMealTypes();
                  }}
                >添加</Button>
              </div>
              <div className="space-y-2">
                {mealTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">暂无种类</p>
                )}
                {mealTypes.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 border border-border/50 rounded-md px-3 py-2">
                    <Input
                      defaultValue={m.name}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (!v || v === m.name) return;
                        await (supabase as any).from("meal_types").update({ name: v }).eq("id", m.id);
                        toast.success("已更新"); loadMealTypes();
                      }}
                      className="flex-1"
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={m.is_active}
                        onChange={async (e) => {
                          await (supabase as any).from("meal_types").update({ is_active: e.target.checked }).eq("id", m.id);
                          loadMealTypes();
                        }}
                      /> 启用
                    </label>
                    <Button
                      size="sm" variant="ghost" className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`删除「${m.name}」?`)) return;
                        await (supabase as any).from("meal_types").delete().eq("id", m.id);
                        toast.success("已删除"); loadMealTypes();
                      }}
                    >删除</Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dutyPersonnelOpen} onOpenChange={setDutyPersonnelOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>轮值表设置</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">更改名称</p>
                {([
                  { key: "duty_sunday_title", defaultTitle: "主日崇拜轮值表" },
                  { key: "duty_summer_title", defaultTitle: "暑期主日学轮值表" },
                ] as const).map(({ key, defaultTitle }) => (
                  <div key={key} className="flex gap-2 items-center">
                    <Label className="text-xs w-16 shrink-0">{defaultTitle.slice(0, 4)}</Label>
                    <Input
                      defaultValue={appSettings[key] ?? defaultTitle}
                      placeholder={defaultTitle}
                      onBlur={async (e) => {
                        const v = e.target.value.trim() || defaultTitle;
                        if (v === (appSettings[key] ?? defaultTitle)) return;
                        const { error } = await (supabase as any)
                          .from("app_settings")
                          .upsert({ key, value: v }, { onConflict: "key" });
                        if (error) return toast.error(error.message);
                        toast.success("已保存名称");
                        loadAppSettings();
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground">添加同工 / 人员管理</p>
              <div className="flex gap-2">
                <Input
                  placeholder="新人员姓名"
                  value={newDutyPersonName}
                  onChange={(e) => setNewDutyPersonName(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    const name = newDutyPersonName.trim();
                    if (!name) return toast.error("请输入姓名");
                    const next = (dutyPersonnel[dutyPersonnel.length - 1]?.sort_order ?? 0) + 1;
                    const { error } = await (supabase as any).from("duty_personnel").insert({ name, sort_order: next });
                    if (error) return toast.error(error.message);
                    setNewDutyPersonName(""); toast.success("已添加"); loadDutyPersonnel();
                  }}
                >添加</Button>
              </div>
              <div className="space-y-2">
                {dutyPersonnel.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">暂无人员</p>
                )}
                {dutyPersonnel.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 border border-border/50 rounded-md px-3 py-2">
                    <Input
                      defaultValue={p.name}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (!v || v === p.name) return;
                        await (supabase as any).from("duty_personnel").update({ name: v }).eq("id", p.id);
                        toast.success("已更新"); loadDutyPersonnel();
                      }}
                      className="flex-1"
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        onChange={async (e) => {
                          await (supabase as any).from("duty_personnel").update({ is_active: e.target.checked }).eq("id", p.id);
                          loadDutyPersonnel();
                        }}
                      /> 启用
                    </label>
                    <Button
                      size="sm" variant="ghost" className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`删除「${p.name}」?`)) return;
                        await (supabase as any).from("duty_personnel").delete().eq("id", p.id);
                        toast.success("已删除"); loadDutyPersonnel();
                      }}
                    >删除</Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={contactsOpen} onOpenChange={setContactsOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 gap-0 bg-card">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-primary text-lg">📖</div>
                <div className="flex flex-col">
                  <DialogTitle className="font-serif text-xl tracking-wide">基督三家通讯录</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Home of Christ · Address Book · 共 {contacts.length} 位</p>
                </div>
              </div>
            </DialogHeader>
          <div className="px-6 py-5">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  placeholder="搜索 姓名 / 电话 / 团契"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <Button size="sm" onClick={() => setContactForm({ name: "", phone: "", wechat: "", email: "", address: "", city: "", zip: "", fellowship: "", notes: "" })}>
                  + 添加联系人
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (contacts.length === 0) return toast.error("无数据可导出");
                    const data = contacts.map((c, i) => ({
                      "序号": i + 1,
                      "姓名": c.name,
                      "电话": c.phone ?? "",
                      "微信": c.wechat ?? "",
                      "邮件": c.email ?? "",
                      "地址": c.address ?? "",
                      "团契": c.fellowship ?? "",
                      "备注": c.notes ?? "",
                    }));
                    const ws = XLSX.utils.json_to_sheet(data);
                    ws["!cols"] = [{ wch: 6 },{ wch: 14 },{ wch: 16 },{ wch: 16 },{ wch: 22 },{ wch: 28 },{ wch: 14 },{ wch: 24 }];
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "通讯录");
                    XLSX.writeFile(wb, `通讯录_${new Date().toISOString().slice(0,10)}.xlsx`);
                    toast.success(`已导出 ${data.length} 条`);
                  }}
                >
                  导出 Excel
                </Button>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        const buf = await f.arrayBuffer();
                        const wb = XLSX.read(buf, { type: "array" });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
                        const get = (r: Record<string, unknown>, keys: string[]) => {
                          for (const k of keys) {
                            if (r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
                          }
                          return null;
                        };
                        const inserts = json
                          .map((r) => ({
                            name: get(r, ["姓名", "name"]) ?? "",
                            phone: get(r, ["电话", "phone"]),
                            wechat: get(r, ["微信", "wechat"]),
                            email: get(r, ["邮件", "邮箱", "email"]),
                            address: get(r, ["地址", "address"]),
                            fellowship: get(r, ["团契", "fellowship"]),
                            notes: get(r, ["备注", "notes"]),
                          }))
                          .filter((r) => r.name);
                        if (inserts.length === 0) return toast.error("未识别到有效数据(需含「姓名」列)");
                        const { error } = await (supabase as any).from("contacts").insert(inserts);
                        if (error) return toast.error(error.message);
                        toast.success(`已导入 ${inserts.length} 条`);
                        loadContacts();
                      } catch (err) {
                        toast.error("导入失败: " + (err as Error).message);
                      }
                    }}
                  />
                  <Button asChild size="sm" variant="outline">
                    <span className="cursor-pointer">导入 Excel</span>
                  </Button>
                </label>
              </div>

              {contactForm && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                  <h4 className="font-medium text-sm">{contactForm.id ? "编辑联系人" : "新增联系人"}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">姓名 *</Label>
                      <Input value={contactForm.name ?? ""} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">电话</Label>
                      <Input value={contactForm.phone ?? ""} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">微信</Label>
                      <Input value={contactForm.wechat ?? ""} onChange={(e) => setContactForm({ ...contactForm, wechat: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">邮件</Label>
                      <Input value={contactForm.email ?? ""} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">地址</Label>
                      <Input value={contactForm.address ?? ""} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">城市</Label>
                      <Input value={contactForm.city ?? ""} onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">邮编</Label>
                      <Input value={contactForm.zip ?? ""} onChange={(e) => setContactForm({ ...contactForm, zip: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">团契</Label>
                      <Input
                        list="contact-fellowship-options"
                        placeholder="输入或选择团契"
                        value={contactForm.fellowship ?? ""}
                        onChange={(e) => setContactForm({ ...contactForm, fellowship: e.target.value })}
                      />
                      <datalist id="contact-fellowship-options">
                        {CONTACT_FELLOWSHIPS.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">备注</Label>
                      <Textarea rows={2} value={contactForm.notes ?? ""} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => setContactForm(null)}>取消</Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const name = (contactForm.name ?? "").trim();
                        if (!name) return toast.error("请填写姓名");
                        const payload = {
                          name,
                          phone: (contactForm.phone ?? "").trim() || null,
                          wechat: (contactForm.wechat ?? "").trim() || null,
                          email: (contactForm.email ?? "").trim() || null,
                          address: (contactForm.address ?? "").trim() || null,
                          city: (contactForm.city ?? "").trim() || null,
                          zip: (contactForm.zip ?? "").trim() || null,
                          fellowship: (contactForm.fellowship ?? "").trim() || null,
                          notes: (contactForm.notes ?? "").trim() || null,
                        };
                        if (contactForm.id) {
                          const { error } = await (supabase as any).from("contacts").update(payload).eq("id", contactForm.id);
                          if (error) return toast.error(error.message);
                          toast.success("已更新");
                        } else {
                          const { error } = await (supabase as any).from("contacts").insert(payload);
                          if (error) return toast.error(error.message);
                          toast.success("已添加");
                        }
                        setContactForm(null);
                        loadContacts();
                      }}
                    >
                      保存
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-muted/80">
                    <tr className="text-left text-muted-foreground border-b border-border/60">
                      <th className="py-2 px-2">姓名</th>
                      <th className="py-2 px-2">在线状态</th>
                      <th className="py-2 px-2">电话</th>
                      <th className="py-2 px-2">微信</th>
                      <th className="py-2 px-2">邮件</th>
                      <th className="py-2 px-2">团契</th>
                      <th className="py-2 px-2">备注</th>
                      <th className="py-2 px-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts
                      .filter((c) => {
                        const q = contactSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          c.name.toLowerCase().includes(q) ||
                          (c.phone ?? "").toLowerCase().includes(q) ||
                          (c.fellowship ?? "").toLowerCase().includes(q)
                        );
                      })
                      .map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-border/30 hover:bg-muted/40 cursor-pointer"
                          onClick={() => {
                            setContactDetail(c);
                            setContactDetailDraft(c);
                            setContactDetailEditing(false);
                          }}
                        >
                          <td className="py-2 px-2 font-medium">{c.name}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            {onlineWorkers.has(c.name.trim()) ? (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <span className="h-2 w-2 rounded-full bg-green-500" />在线
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />离线
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2">{c.phone ?? ""}</td>
                          <td className="py-2 px-2">{c.wechat ?? ""}</td>
                          <td className="py-2 px-2">{c.email ?? ""}</td>
                          <td className="py-2 px-2">{c.fellowship ?? ""}</td>
                          <td className="py-2 px-2 max-w-[200px] truncate text-muted-foreground">{c.notes ?? ""}</td>
                          <td className="py-2 px-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button className="text-xs text-primary hover:underline mr-3" onClick={() => setContactForm(c)}>编辑</button>
                            <button
                              className="text-xs text-destructive hover:underline"
                              onClick={async () => {
                                if (!confirm(`删除 ${c.name}?`)) return;
                                const { error } = await (supabase as any).from("contacts").delete().eq("id", c.id);
                                if (error) return toast.error(error.message);
                                toast.success("已删除");
                                loadContacts();
                              }}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    {contacts.length === 0 && (
                      <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">暂无联系人</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </DialogContent>
        </Dialog>

        {/* Contact detail dialog */}
        <Dialog
          open={!!contactDetail}
          onOpenChange={(o) => {
            if (!o) {
              setContactDetail(null);
              setContactDetailEditing(false);
              setContactDetailDraft(null);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">
                {contactDetailEditing ? "编辑联系人" : "联系人详情"}
              </DialogTitle>
            </DialogHeader>
            {contactDetail && contactDetailDraft && (
              <div className="space-y-3 text-sm">
                {([
                  ["姓名", "name"],
                  ["电话", "phone"],
                  ["微信", "wechat"],
                  ["邮件", "email"],
                  ["地址", "address"],
                  ["城市", "city"],
                  ["邮编", "zip"],
                  ["团契", "fellowship"],
                ] as const).map(([label, key]) => (
                  <div key={key} className="grid grid-cols-[80px_1fr] items-center gap-3">
                    <Label className="text-muted-foreground">{label}</Label>
                    {contactDetailEditing ? (
                      <Input
                        value={(contactDetailDraft as any)[key] ?? ""}
                        onChange={(e) =>
                          setContactDetailDraft({ ...contactDetailDraft, [key]: e.target.value })
                        }
                      />
                    ) : (
                      <div className="py-1">{(contactDetail as any)[key] || <span className="text-muted-foreground">—</span>}</div>
                    )}
                  </div>
                ))}
                <div className="grid grid-cols-[80px_1fr] items-start gap-3">
                  <Label className="text-muted-foreground pt-1">备注</Label>
                  {contactDetailEditing ? (
                    <Textarea
                      rows={3}
                      value={contactDetailDraft.notes ?? ""}
                      onChange={(e) => setContactDetailDraft({ ...contactDetailDraft, notes: e.target.value })}
                    />
                  ) : (
                    <div className="py-1 whitespace-pre-wrap">
                      {contactDetail.notes || <span className="text-muted-foreground">—</span>}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  {contactDetailEditing ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setContactDetailDraft(contactDetail);
                          setContactDetailEditing(false);
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={async () => {
                          const name = (contactDetailDraft.name ?? "").trim();
                          if (!name) return toast.error("姓名必填");
                          const payload: any = {
                            name,
                            phone: (contactDetailDraft.phone ?? "").trim() || null,
                            wechat: (contactDetailDraft.wechat ?? "").trim() || null,
                            email: (contactDetailDraft.email ?? "").trim() || null,
                            address: (contactDetailDraft.address ?? "").trim() || null,
                            city: (contactDetailDraft.city ?? "").trim() || null,
                            zip: (contactDetailDraft.zip ?? "").trim() || null,
                            fellowship: (contactDetailDraft.fellowship ?? "").trim() || null,
                            notes: (contactDetailDraft.notes ?? "").trim() || null,
                          };
                          const { error } = await (supabase as any)
                            .from("contacts")
                            .update(payload)
                            .eq("id", contactDetail.id);
                          if (error) return toast.error(error.message);
                          toast.success("已保存");
                          await loadContacts();
                          const updated = { ...contactDetail, ...payload } as Contact;
                          setContactDetail(updated);
                          setContactDetailDraft(updated);
                          setContactDetailEditing(false);
                        }}
                      >
                        保存
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setContactDetail(null);
                          setContactDetailDraft(null);
                        }}
                      >
                        关闭
                      </Button>
                      <Button onClick={() => setContactDetailEditing(true)}>编辑</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Kids Sunday School Settings Dialog */}
        <Dialog open={kidsSettingsSeason !== null} onOpenChange={(o) => { if (!o) setKidsSettingsSeason(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {kidsSettingsSeason ? `设置 · ${appSettings[`${KIDS_TRACKS[kidsSettingsSeason].key}_title`] || KIDS_TRACKS[kidsSettingsSeason].title}` : "设置"}
              </DialogTitle>
            </DialogHeader>
            {kidsSettingsSeason && (
              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <Label className="text-xs">板块名称</Label>
                  <div className="flex gap-2">
                    <Input
                      key={`${kidsSettingsSeason}-${appSettings[`${KIDS_TRACKS[kidsSettingsSeason].key}_title`] ?? ""}`}
                      defaultValue={appSettings[`${KIDS_TRACKS[kidsSettingsSeason].key}_title`] || KIDS_TRACKS[kidsSettingsSeason].title}
                      onBlur={async (e) => {
                        const key = `${KIDS_TRACKS[kidsSettingsSeason].key}_title`;
                        const v = e.target.value.trim();
                        if (!v) return;
                        if (v === (appSettings[key] || KIDS_TRACKS[kidsSettingsSeason].title)) return;
                        const { error } = await (supabase as any)
                          .from("app_settings")
                          .upsert({ key, value: v, updated_at: new Date().toISOString() });
                        if (error) return toast.error(error.message);
                        toast.success("已保存名称");
                        loadAppSettings();
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">失焦后自动保存。</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">添加同工 (老师列表)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={kidsNewTeacher}
                      placeholder="输入同工姓名"
                      onChange={(e) => setKidsNewTeacher(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key !== "Enter") return;
                        const name = kidsNewTeacher.trim();
                        if (!name) return;
                        const next = (sundayTeachers[sundayTeachers.length - 1]?.sort_order ?? 0) + 1;
                        const { error } = await (supabase as any)
                          .from("sunday_school_teachers")
                          .insert({ name, sort_order: next, is_active: true });
                        if (error) return toast.error(error.message);
                        toast.success("已添加");
                        setKidsNewTeacher("");
                        loadSundayTeachers();
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        const name = kidsNewTeacher.trim();
                        if (!name) return toast.error("请输入姓名");
                        const next = (sundayTeachers[sundayTeachers.length - 1]?.sort_order ?? 0) + 1;
                        const { error } = await (supabase as any)
                          .from("sunday_school_teachers")
                          .insert({ name, sort_order: next, is_active: true });
                        if (error) return toast.error(error.message);
                        toast.success("已添加");
                        setKidsNewTeacher("");
                        loadSundayTeachers();
                      }}
                    >
                      添加
                    </Button>
                  </div>
                  {sundayTeachers.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {sundayTeachers.filter((t) => t.is_active).map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1">
                          {t.name}
                          <button
                            className="text-muted-foreground hover:text-destructive ml-0.5"
                            onClick={async () => {
                              if (!confirm(`移除同工「${t.name}」?`)) return;
                              await (supabase as any).from("sunday_school_teachers").delete().eq("id", t.id);
                              loadSundayTeachers();
                            }}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">同工姓名将出现在课程「老师」列的下拉建议中。</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setKidsSettingsSeason(null)}>完成</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

                <div className="space-y-2">
                  <Label>如何知道我们教会</Label>
                  <RadioGroup value={editForm.source_channel ?? ""} onValueChange={(v) => setEditForm((prev) => prev ? { ...prev, source_channel: v } : prev)} className="flex flex-wrap gap-4 pt-2">
                    {[
                      { v: "chatgpt", l: "ChatGPT" },
                      { v: "maps", l: "谷歌/苹果地图" },
                      { v: "wechat", l: "微信/小红书" },
                      { v: "youtube", l: "YouTube" },
                      { v: "missionary", l: "宣教士" },
                    ].map((o) => (
                      <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                      </label>
                    ))}
                  </RadioGroup>
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

        {/* QR Library Dialog */}
        <Dialog open={qrLibOpen} onOpenChange={setQrLibOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>二维码库</DialogTitle>
            </DialogHeader>
            <QrLibrary publicBase={publicBase} events={events} />
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}

function QrLibrary({ publicBase, events }: { publicBase: string; events: Event[] }) {
  const activeEvent = events.find((e) => e.is_active) ?? events[0];
  const items: { key: string; label: string; url: string }[] = [
    {
      key: "register",
      label: "扫码登记 (新人登记)",
      url: activeEvent ? `${publicBase}/register?event=${activeEvent.qr_token}` : "",
    },
    { key: "retreat", label: "退修会登记", url: `${publicBase}/retreat` },
    { key: "sunday", label: "成人主日学签到", url: `${publicBase}/sunday-checkin` },
    { key: "adult-summer", label: "暑期成人主日学 · 扫码签到", url: `${publicBase}/adult-checkin/summer` },
    { key: "adult-fall", label: "秋季成人主日学 · 扫码签到", url: `${publicBase}/adult-checkin/fall` },
    { key: "serve", label: "服侍申请", url: `${publicBase}/serve-apply` },
    { key: "fellowship", label: "团契 / 小组聚会签到", url: `${publicBase}/fellowship-checkin` },
    { key: "feedback", label: "问题反馈", url: `${publicBase}/feedback` },
  ];

  function copyUrl(url: string) {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success("二维码地址已复制");
  }

  function printQr(label: string, url: string) {
    if (!url) return;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${label}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;}
h1{font-size:28px;margin:0 0 16px;}p{color:#555;margin:16px 0 0;font-size:14px;word-break:break-all;text-align:center;max-width:520px;}
img{width:480px;height:480px;}@media print{@page{margin:1cm;}}</style></head>
<body><h1>${label}</h1><img src="${qrSrc}" alt="QR"/><p>${url}</p>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("浏览器拦截了弹窗"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
      {items.map((it) => (
        <div key={it.key} className="border border-border/50 rounded-xl p-4 flex flex-col items-center gap-3 bg-background">
          <div className="text-sm font-medium text-center">{it.label}</div>
          {it.url ? (
            <div className="bg-white p-2 rounded">
              <QRCodeSVG value={it.url} size={150} level="H" />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground py-12">暂无有效二维码</div>
          )}
          <div className="text-[10px] text-muted-foreground break-all text-center leading-tight px-1">{it.url || "—"}</div>
          <div className="flex gap-2 w-full">
            <Button size="sm" variant="outline" className="flex-1" disabled={!it.url} onClick={() => copyUrl(it.url)}>复制地址</Button>
            <Button size="sm" className="flex-1" disabled={!it.url} onClick={() => printQr(it.label, it.url)}>打印</Button>
          </div>
        </div>
      ))}
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

function countDatesSince(dates: string[], since: Date) {
  return dates.filter((d) => new Date(d + "T00:00:00") >= since).length;
}
function countDatesBetween(dates: string[], from: Date, to: Date) {
  return dates.filter((d) => {
    const t = new Date(d + "T00:00:00");
    return t >= from && t < to;
  }).length;
}

function CheckinActivityCard({
  title,
  dates,
  categories,
  categoryLabel,
}: {
  title: string;
  dates: string[];
  categories: string[];
  categoryLabel: string;
}) {
  const sow = startOfWeek();
  const psow = prevStartOfWeek();
  const som = startOfMonth();
  const psom = prevStartOfMonth();

  const thisWeek = countDatesSince(dates, sow);
  const lastWeek = countDatesBetween(dates, psow, sow);
  const thisMonth = countDatesSince(dates, som);
  const lastMonth = countDatesBetween(dates, psom, som);
  const total = dates.length;

  const activeThisWeek = new Set(
    categories.filter((_, i) => new Date(dates[i] + "T00:00:00") >= sow),
  ).size;

  const weekDelta = thisWeek - lastWeek;
  const monthDelta = thisMonth - lastMonth;
  const weekPct = lastWeek > 0 ? Math.round((weekDelta / lastWeek) * 100) : (thisWeek > 0 ? 100 : 0);
  const monthPct = lastMonth > 0 ? Math.round((monthDelta / lastMonth) * 100) : (thisMonth > 0 ? 100 : 0);

  const arrowColor = (delta: number) =>
    delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground";
  const arrowGlyph = (delta: number) => (delta > 0 ? "▲" : delta < 0 ? "▼" : "→");

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg">{title}</h3>
        <span className="text-xs text-muted-foreground">累计 {total} 人次</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border/40 rounded-xl p-4">
          <div className="text-xs text-muted-foreground">本周参加</div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-2xl font-serif">{thisWeek}</div>
            <div className={`text-xs flex items-center gap-1 ${arrowColor(weekDelta)}`}>
              <span>{arrowGlyph(weekDelta)}</span>
              <span>{weekDelta > 0 ? "+" : ""}{weekDelta} ({weekPct > 0 ? "+" : ""}{weekPct}%)</span>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">上周 {lastWeek} 人次</div>
        </div>
        <div className="border border-border/40 rounded-xl p-4">
          <div className="text-xs text-muted-foreground">本月参加</div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-2xl font-serif">{thisMonth}</div>
            <div className={`text-xs flex items-center gap-1 ${arrowColor(monthDelta)}`}>
              <span>{arrowGlyph(monthDelta)}</span>
              <span>{monthDelta > 0 ? "+" : ""}{monthDelta} ({monthPct > 0 ? "+" : ""}{monthPct}%)</span>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">上月 {lastMonth} 人次</div>
        </div>
        <div className="border border-border/40 rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{categoryLabel}</div>
          <div className="text-2xl font-serif mt-1">{activeThisWeek}</div>
          <div className="text-[11px] text-muted-foreground mt-1">本周不同分组数量</div>
        </div>
        <div className="border border-border/40 rounded-xl p-4">
          <div className="text-xs text-muted-foreground">活动积极性</div>
          <div className={`text-2xl font-serif mt-1 flex items-center gap-2 ${arrowColor(weekDelta)}`}>
            <span>{arrowGlyph(weekDelta)}</span>
            <span className="text-base">{weekDelta > 0 ? "上升" : weekDelta < 0 ? "下降" : "持平"}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">对比上周</div>
        </div>
      </div>
    </div>
  );
}

function Tag({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "accent" }) {
  const cls = tone === "accent"
    ? "bg-accent/30 text-accent-foreground"
    : "bg-primary/15 text-primary";
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

// 儿童主日学统计 — 数据来自「人数统计」录入（attendance_records）
function KidsAttendanceStats({ records }: { records: AttendanceRecord[] }) {
  const sow = startOfWeek();
  const psow = prevStartOfWeek();
  const som = startOfMonth();
  const psom = prevStartOfMonth();
  const inRange = (date: string, from: Date, to?: Date) => {
    const t = new Date(date + "T00:00:00");
    return t >= from && (!to || t < to);
  };
  const sumIn = (from: Date, to: Date | undefined, key: "children_students" | "children_teachers") =>
    records.filter((r) => inRange(r.record_date, from, to)).reduce((a, r) => a + (r[key] || 0), 0);

  const wkStudents = sumIn(sow, undefined, "children_students");
  const lwStudents = sumIn(psow, sow, "children_students");
  const moStudents = sumIn(som, undefined, "children_students");
  const lmStudents = sumIn(psom, som, "children_students");
  const wkTeachers = sumIn(sow, undefined, "children_teachers");
  const lwTeachers = sumIn(psow, sow, "children_teachers");
  const moTeachers = sumIn(som, undefined, "children_teachers");
  const lmTeachers = sumIn(psom, som, "children_teachers");

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatDeltaCard label="本周老师" current={wkTeachers} previous={lwTeachers} previousLabel="上周" />
        <StatDeltaCard label="本月老师" current={moTeachers} previous={lmTeachers} previousLabel="上月" />
        <StatDeltaCard label="本周学生" current={wkStudents} previous={lwStudents} previousLabel="上周" />
        <StatDeltaCard label="本月学生" current={moStudents} previous={lmStudents} previousLabel="上月" />
      </div>
    </div>
  );
}

function StatDeltaCard({
  label, current, previous, previousLabel,
}: { label: string; current: number; previous: number; previousLabel: string }) {
  const delta = current - previous;
  const pct = previous > 0 ? Math.round((delta / previous) * 100) : (current > 0 ? 100 : 0);
  const color = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground";
  const glyph = delta > 0 ? "▲" : delta < 0 ? "▼" : "→";
  return (
    <div className="border border-border/40 rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <div className="text-2xl font-serif">{current}</div>
        <div className={`text-xs flex items-center gap-1 ${color}`}>
          <span>{glyph}</span>
          <span>{delta > 0 ? "+" : ""}{delta} ({pct > 0 ? "+" : ""}{pct}%)</span>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{previousLabel} {previous} 人次</div>
    </div>
  );
}

type KidsSnapshot = {
  id: string; class_id: string; track: string; class_name: string | null;
  student_count: number; snapshot_date: string;
};

function KidsEnrollmentStats({
  classes, snapshots,
}: { classes: KidsRow[]; snapshots: KidsSnapshot[] }) {
  // 取某 class 在指定区间内"最新"快照（end 为 exclusive 上界，可省略表示当前）
  const latestIn = (classId: string, end?: Date, start?: Date) => {
    const list = snapshots
      .filter((s) => s.class_id === classId)
      .filter((s) => {
        const t = new Date(s.snapshot_date + "T00:00:00");
        if (end && t >= end) return false;
        if (start && t < start) return false;
        return true;
      });
    return list.length > 0 ? list[0].student_count : null; // snapshots already sorted desc
  };

  const sow = startOfWeek();
  const psow = prevStartOfWeek();
  const som = startOfMonth();
  const psom = prevStartOfMonth();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);

  const tracks: Array<{ key: string; title: string }> = [
    { key: KIDS_TRACKS.spring.key, title: KIDS_TRACKS.spring.title },
    { key: KIDS_TRACKS.fall.key, title: KIDS_TRACKS.fall.title },
  ];

  const exportExcel = () => {
    const sheetData: Record<string, unknown>[] = [];
    for (const t of tracks) {
      classes.filter((c) => c.track === t.key).forEach((c) => {
        const current = c.student_count ?? 0;
        const lastWeekVal = latestIn(c.id, sow, psow) ?? 0;
        const lastMonthVal = latestIn(c.id, som, psom) ?? 0;
        const lastYearVal = latestIn(c.id, yearStart, lastYearStart) ?? 0;
        sheetData.push({
          "学期": t.title,
          "班级": c.class_name ?? "",
          "当前人数": current,
          "上周人数": lastWeekVal,
          "本周变化": current - lastWeekVal,
          "本周变化%": lastWeekVal > 0 ? Math.round(((current - lastWeekVal) / lastWeekVal) * 100) + "%" : "—",
          "上月人数": lastMonthVal,
          "本月变化": current - lastMonthVal,
          "本月变化%": lastMonthVal > 0 ? Math.round(((current - lastMonthVal) / lastMonthVal) * 100) + "%" : "—",
          "去年同期": lastYearVal,
          "年度变化": current - lastYearVal,
        });
      });
    }
    if (sheetData.length === 0) { toast.error("无数据可导出"); return; }
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "儿童班级报名统计");
    XLSX.writeFile(wb, `儿童班级报名统计_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("已导出");
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-6">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportExcel}>导出 Excel</Button>
      </div>
      {tracks.map((t) => {
        const list = classes.filter((c) => c.track === t.key);
        const total = list.reduce((a, c) => a + (c.student_count ?? 0), 0);
        return (
          <div key={t.key} className="space-y-3">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h3 className="font-serif text-lg">{t.title}</h3>
              <span className="text-xs text-muted-foreground">总人数 {total}</span>
            </div>
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无班级</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {list.map((c) => {
                  const current = c.student_count ?? 0;
                  const lastWeekVal = latestIn(c.id, sow, psow);
                  const lastMonthVal = latestIn(c.id, som, psom);
                  const lastYearVal = latestIn(c.id, yearStart, lastYearStart);
                  const wkDelta = current - (lastWeekVal ?? current);
                  const moDelta = current - (lastMonthVal ?? current);
                  const yrDelta = current - (lastYearVal ?? current);
                  const wkPct = lastWeekVal && lastWeekVal > 0 ? Math.round((wkDelta / lastWeekVal) * 100) : null;
                  const moPct = lastMonthVal && lastMonthVal > 0 ? Math.round((moDelta / lastMonthVal) * 100) : null;
                  const yrPct = lastYearVal && lastYearVal > 0 ? Math.round((yrDelta / lastYearVal) * 100) : null;
                  const color = (d: number) => d > 0 ? "text-emerald-600" : d < 0 ? "text-red-600" : "text-muted-foreground";
                  const glyph = (d: number) => d > 0 ? "▲" : d < 0 ? "▼" : "→";
                  return (
                    <div key={c.id} className="border border-border/40 rounded-xl p-4">
                      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
                        <div className="font-medium truncate">{c.class_name || "未命名"}</div>
                        <div className="text-2xl font-serif">{current}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">本周变化</div>
                          <div className={`flex items-center gap-1 ${color(wkDelta)}`}>
                            <span>{glyph(wkDelta)}</span>
                            <span>{wkDelta > 0 ? "+" : ""}{wkDelta}{wkPct !== null ? ` (${wkPct > 0 ? "+" : ""}${wkPct}%)` : ""}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">上周 {lastWeekVal ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">本月变化</div>
                          <div className={`flex items-center gap-1 ${color(moDelta)}`}>
                            <span>{glyph(moDelta)}</span>
                            <span>{moDelta > 0 ? "+" : ""}{moDelta}{moPct !== null ? ` (${moPct > 0 ? "+" : ""}${moPct}%)` : ""}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">上月 {lastMonthVal ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">今年/去年</div>
                          <div className={`flex items-center gap-1 ${color(yrDelta)}`}>
                            <span>{glyph(yrDelta)}</span>
                            <span>{yrDelta > 0 ? "+" : ""}{yrDelta}{yrPct !== null ? ` (${yrPct > 0 ? "+" : ""}${yrPct}%)` : ""}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">去年 {lastYearVal ?? "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SundayParticipationStats({
  checkins, courses,
}: { checkins: SundayCheckin[]; courses: Course[] }) {
  const REQUIRED = [
    "新旧约书卷", "诗篇及历史书", "丰盛生命", "基要真理",
    "新约概论", "旧约概论", "主所喜悦的家庭", "因为日期近了", "受洗班",
  ];
  const activeNames = courses.filter((c) => c.is_active).map((c) => c.name);
  const all = Array.from(new Set([...REQUIRED, ...activeNames]));

  const sow = startOfWeek();
  const psow = prevStartOfWeek();
  const som = startOfMonth();
  const psom = prevStartOfMonth();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);

  const countIn = (name: string, from: Date, to?: Date) =>
    checkins.filter((k) => {
      if ((k.course_name ?? "") !== name) return false;
      const t = new Date(k.checkin_date + "T00:00:00");
      return t >= from && (!to || t < to);
    }).length;

  const color = (d: number) => d > 0 ? "text-emerald-600" : d < 0 ? "text-red-600" : "text-muted-foreground";
  const glyph = (d: number) => d > 0 ? "▲" : d < 0 ? "▼" : "→";
  const pctStr = (cur: number, prev: number) => prev > 0 ? `${cur - prev > 0 ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)}%` : (cur > 0 ? "+100%" : "0%");

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6">
      {all.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无课程</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {all.map((name) => {
            const wk = countIn(name, sow);
            const lwk = countIn(name, psow, sow);
            const mo = countIn(name, som);
            const lmo = countIn(name, psom, som);
            const yr = countIn(name, yearStart);
            const lyr = countIn(name, lastYearStart, yearStart);
            return (
              <div key={name} className="border border-border/40 rounded-xl p-4">
                <div className="font-medium mb-3 truncate">{name}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">本周</div>
                    <div className="text-xl font-serif">{wk}</div>
                    <div className={`flex items-center gap-1 ${color(wk - lwk)}`}>
                      <span>{glyph(wk - lwk)}</span><span>{pctStr(wk, lwk)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">上周 {lwk}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">本月</div>
                    <div className="text-xl font-serif">{mo}</div>
                    <div className={`flex items-center gap-1 ${color(mo - lmo)}`}>
                      <span>{glyph(mo - lmo)}</span><span>{pctStr(mo, lmo)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">上月 {lmo}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">本年</div>
                    <div className="text-xl font-serif">{yr}</div>
                    <div className={`flex items-center gap-1 ${color(yr - lyr)}`}>
                      <span>{glyph(yr - lyr)}</span><span>{pctStr(yr, lyr)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">去年 {lyr}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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