import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";

/**
 * 长老总览 / 今日周报总览
 * 黑白三栏纸质周报风格，适合打印 / 导出 PDF。
 * 编辑字段（服侍轮值表、主日崇拜程序、本周家讯、祷告事项）
 * 持久化到 localStorage，避免新增表。其它列从已有数据派生。
 */

type Reg = { id: string; created_at: string; name?: string | null };
type Attendance = {
  id: string;
  record_date: string;
  worship_count: number;
  children_students: number;
  children_teachers: number;
  notes?: string | null;
};
type Checkin = { checkin_date: string; name: string };
type SundayCheckin = Checkin & { course_name?: string | null };
type FellowshipCheckin = Checkin & { fellowship: string };
type Course = { id: string; name: string };
type Fellowship = { id: string; name: string };
type MealPlan = { id: string; plan_date: string; attendees: number; meal_type?: string | null };
type KidsClass = {
  id?: string;
  track: string;
  class_name: string | null;
  course_name?: string | null;
  teacher_name: string | null;
  class_location: string | null;
  sort_order: number;
};

export type ElderOverviewProps = {
  regs: Reg[];
  attendance: Attendance[];
  sundayCheckins: SundayCheckin[];
  fellowshipCheckins: FellowshipCheckin[];
  courses: Course[];
  fellowships: Fellowship[];
  mealPlans: MealPlan[];
  kidsClasses?: KidsClass[];
  onRefresh?: () => void;
};

const LS_KEY = "elder.weekly.overview.v1";
const LS_KEY_BYDATE = "elder.weekly.overview.byDate.v1";

type Editable = {
  duty: string;
  kids: string;
  worship: string;
  newsletter: string;
  prayer: string;
  offerings: string;
  worshipProgram?: WorshipProgram;
};

export type WorshipProgram = {
  xuanzhao: string;   // 宣召
  changshi: string;   // 唱诗
  xianshi: string;    // 献诗
  jingwen: string;    // 经文诵读
  jingxun: string;    // 经训
  xinxi: string;      // 信息
  fengxian: string;   // 奉献诗歌
};

const DEFAULT_WORSHIP_PROGRAM: WorshipProgram = {
  xuanzhao: "",
  changshi: "",
  xianshi: "",
  jingwen: "",
  jingxun: "",
  xinxi: "",
  fengxian: "",
};

const WORSHIP_FIELDS: { key: keyof WorshipProgram; label: string; role: string; placeholder: string }[] = [
  { key: "xuanzhao", label: "宣召", role: "司会", placeholder: "诗篇 XX 篇" },
  { key: "changshi", label: "唱诗", role: "会众", placeholder: "教会圣诗 XX 首" },
  { key: "xianshi", label: "献诗", role: "诗班", placeholder: "诗歌名称" },
  { key: "jingwen", label: "经文诵读", role: "会众", placeholder: "经文出处" },
  { key: "jingxun", label: "经训", role: "会众", placeholder: "经文出处" },
  { key: "xinxi", label: "信息", role: "牧师", placeholder: "讲道题目" },
  { key: "fengxian", label: "奉献诗歌", role: "会众", placeholder: "教会圣诗 XX 首" },
];

/** 固定模板：未列出的项目（默祷 / 牧祷 / 奉献祷告 / 三一颂 / 祝福 / 报告 等）由系统自动填充 */
type ProgramLine =
  | { kind: "section"; text: string }
  | { kind: "fixed"; left: string; right: string }
  | { kind: "editable"; key: keyof WorshipProgram; left: string; right: string };
const PROGRAM_TEMPLATE: ProgramLine[] = [
  { kind: "section", text: "安静默祷，俯心敬拜" },
  { kind: "editable", key: "xuanzhao", left: "宣召", right: "司会" },
  { kind: "fixed", left: "默祷", right: "会众" },
  { kind: "section", text: "以颂赞来敬拜" },
  { kind: "editable", key: "changshi", left: "唱诗", right: "会众" },
  { kind: "fixed", left: "牧祷", right: "牧师" },
  { kind: "section", text: "以领受来敬拜" },
  { kind: "editable", key: "xianshi", left: "献诗", right: "诗班" },
  { kind: "editable", key: "jingwen", left: "经文诵读", right: "会众" },
  { kind: "editable", key: "jingxun", left: "经训", right: "会众" },
  { kind: "editable", key: "xinxi", left: "信息", right: "牧师" },
  { kind: "section", text: "以奉献来敬拜" },
  { kind: "editable", key: "fengxian", left: "奉献诗歌", right: "会众" },
  { kind: "fixed", left: "奉献祷告", right: "司会" },
  { kind: "fixed", left: "三一颂", right: "会众" },
  { kind: "fixed", left: "祝福", right: "长老" },
  { kind: "fixed", left: "报告", right: "司会" },
  { kind: "fixed", left: "默祷", right: "会众" },
];

const DEFAULT_EDITABLE: Editable = {
  duty: [
    "讲员：————",
    "司会：————",
    "领诗：————",
    "司琴：————",
    "招待：————",
    "新人接待：————",
    "圣餐服事：————",
    "餐前投影：————",
    "视频播放：————",
    "厨房服事：————",
    "堂务：————",
    "插花：————",
  ].join("\n"),
  kids: [
    "Nursery (0-2岁)：————",
    "Preschool (3-5岁)：————",
    "K/1st (K-1年级)：————",
    "2nd/3rd (2-3年级)：————",
    "4th/5th (4-5年级)：————",
  ].join("\n"),
  worship: [
    "# 安静默祷，俯心敬拜",
    "宣召……诗篇 ____……司会",
    "默祷……会众",
    "# 以颂赞来敬拜",
    "唱诗……教会圣诗 ____……会众",
    "牧祷……牧师",
    "# 以领受来敬拜",
    "献诗……当敬拜耶和华……诗班",
    "经文诵读……____……会众",
    "讲训……____……会众",
    "信息……____……牧师",
    "# 以奉献来敬拜",
    "奉献诗歌……教会圣诗 ____……会众",
    "奉献祷告……司会",
    "三一颂……会众",
    "祝福……长老",
    "报告……司会",
    "默祷……会众",
    "> 經訓：耶和華的道理潔淨，存到永遠；耶和華的典章真實，全然公義。都比金子可羨慕，且比極多的精金可羨慕，比蜜甘甜，且比蜂房下滴的蜜甘甜。（詩篇 19:9-10）",
  ].join("\n"),
  newsletter: "本周家讯：————",
  prayer: "祷告事项：————",
  offerings: "Check：$ ____\nZelle：$ ____\nAR：$ ____\nCash：$ ____\nTotal：$ ____",
};

/** 按主日存储 Editable 字段 */
type ByDateStore = Record<string, Partial<Editable>>;
function loadByDate(): ByDateStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY_BYDATE);
    if (raw) return JSON.parse(raw) as ByDateStore;
    // 迁移：旧版单一存储 → 作为当前主日默认
    const legacy = localStorage.getItem(LS_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<Editable>;
      const sunday = toISO(currentSundayOf(new Date()));
      return { [sunday]: old };
    }
    return {};
  } catch {
    return {};
  }
}
function getEditableFor(store: ByDateStore, sundayISO: string): Editable {
  const partial = store[sundayISO] ?? {};
  const merged = { ...DEFAULT_EDITABLE, ...partial };
  if (
    !merged.worship.includes("# 以颂赞来敬拜") ||
    !merged.worship.includes("經訓")
  ) {
    merged.worship = DEFAULT_EDITABLE.worship;
  }
  return merged;
}

function fmtCN(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** 返回 d 所在周的礼拜天（周日）日期，时区取本地 */
function currentSundayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  // 取本周日：若今天就是周日，返回今天；否则取下一个 Sunday? 用户要求"如果当前日期不是礼拜天，也要自动定位到本周主日"
  // 解读为本周已过的主日（上一个周日）。
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function sameLocalDate(iso: string, day: Date) {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}
function sameISO(iso: string, sundayISO: string) {
  return iso.startsWith(sundayISO);
}

/** 简单 < > 翻页箭头（纸质风格） */
function NavArrows({ onPrev, onNext, children }: { onPrev: () => void; onNext: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        className="px-1 text-[18px] leading-none hover:opacity-60 print:hidden"
        aria-label="上一个主日"
      >
        ‹
      </button>
      <span>{children}</span>
      <button
        type="button"
        onClick={onNext}
        className="px-1 text-[18px] leading-none hover:opacity-60 print:hidden"
        aria-label="下一个主日"
      >
        ›
      </button>
    </div>
  );
}

export function ElderWeeklyOverview(props: ElderOverviewProps) {
  const { regs, attendance, sundayCheckins, fellowshipCheckins, courses, fellowships, mealPlans, kidsClasses = [], onRefresh } = props;
  const today = useMemo(() => new Date(), []);
  const todaySunday = useMemo(() => currentSundayOf(today), [today]);
  const todaySundayISO = toISO(todaySunday);

  // 各板块独立的主日（默认本周主日）
  const [headerSunday, setHeaderSunday] = useState<string>(todaySundayISO);
  const [dutySunday, setDutySunday] = useState<string>(todaySundayISO);
  const [attSunday, setAttSunday] = useState<string>(todaySundayISO);
  const [courseSunday, setCourseSunday] = useState<string>(todaySundayISO);
  const [fellowSunday, setFellowSunday] = useState<string>(todaySundayISO);

  const [byDate, setByDate] = useState<ByDateStore>(() => loadByDate());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY_BYDATE, JSON.stringify(byDate)); } catch {}
  }, [byDate]);

  // 当前 header 主日对应的可编辑模板
  const editHeader = getEditableFor(byDate, headerSunday);
  const editDuty = getEditableFor(byDate, dutySunday);
  const updateForDate = (sundayISO: string, patch: Partial<Editable>) => {
    setByDate((prev) => ({ ...prev, [sundayISO]: { ...(prev[sundayISO] ?? {}), ...patch } }));
  };

  const currentProgram: WorshipProgram = {
    ...DEFAULT_WORSHIP_PROGRAM,
    ...(editHeader.worshipProgram ?? {}),
  };
  const updateProgramField = (k: keyof WorshipProgram, v: string) => {
    updateForDate(headerSunday, {
      worshipProgram: { ...currentProgram, [k]: v },
    });
  };
  const copyFromLastWeek = () => {
    const prevISO = shiftSunday(headerSunday, -1);
    const prev = byDate[prevISO]?.worshipProgram;
    if (!prev) {
      alert("上一个主日（" + prevISO + "）暂无敬拜程序数据");
      return;
    }
    updateForDate(headerSunday, { worshipProgram: { ...DEFAULT_WORSHIP_PROGRAM, ...prev } });
  };

  const headerDate = new Date(headerSunday + "T00:00:00");
  const wkStart = startOfWeek(headerDate);

  const shiftSunday = (iso: string, weeks: number) => toISO(addDays(new Date(iso + "T00:00:00"), weeks * 7));

  // 板块数据：按所选主日精确匹配
  const attRecord = attendance.find((a) => a.record_date === attSunday) ?? null;
  const courseSundayCheckins = sundayCheckins.filter((c) => sameISO(c.checkin_date, courseSunday));

  // 团契 / 小组：统一以 当周礼拜二 ~ 当周礼拜天（主日）为统计区间
  const fellowRangeStart = addDays(new Date(fellowSunday + "T00:00:00"), -5); // Tue
  const fellowRangeEnd = new Date(fellowSunday + "T00:00:00"); // Sun
  const fellowMatches = (_f: string, iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d >= fellowRangeStart && d <= fellowRangeEnd;
  };

  return (
    <section className="mt-8 print:mt-0">
      <div className="flex items-center justify-between mb-3 print:hidden">
        <div className="text-xs text-muted-foreground">电子版教会周报 · 数据自动汇总</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs px-2.5 py-1 border border-black/70 bg-white text-black hover:bg-neutral-100"
          >
            {editing ? "完成编辑" : "编辑模板"}
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs px-2.5 py-1 border border-black/70 bg-white text-black hover:bg-neutral-100"
            >
              刷新数据
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="text-xs px-2.5 py-1 border border-black/70 bg-white text-black hover:bg-neutral-100"
          >
            打印 / 导出 PDF
          </button>
        </div>
      </div>

      <div
        id="elder-bulletin"
        className="bg-white text-black p-6 print:p-2"
        style={{ fontFamily: "'PMingLiU','MingLiU','SimSun','宋体',serif", fontSize: "17px", lineHeight: 1.55, fontWeight: 600 }}
      >
        <div className="text-center pb-2 mb-4">
          <div
            className="text-[22px] tracking-[0.12em]"
            style={{ fontFamily: "'STZhongsong','STSong','SimSun',serif", fontWeight: 700 }}
          >
            基督之家第三家
          </div>
          <div
            className="text-[24px] tracking-[0.12em] mt-1"
            style={{ fontFamily: "'STZhongsong','STSong','SimSun',serif", fontWeight: 700 }}
          >
            今日周报总览
          </div>
          <div
            className="text-[14px] mt-1 tracking-widest"
            style={{ fontFamily: "'Times New Roman','PMingLiU',serif" }}
          >
            <NavArrows
              onPrev={() => {
                const s = shiftSunday(headerSunday, -1);
                setHeaderSunday(s); setDutySunday(s); setAttSunday(s); setCourseSunday(s); setFellowSunday(s);
              }}
              onNext={() => {
                const s = shiftSunday(headerSunday, 1);
                setHeaderSunday(s); setDutySunday(s); setAttSunday(s); setCourseSunday(s); setFellowSunday(s);
              }}
            >
              主后 {headerDate.getFullYear()} 年 {headerDate.getMonth() + 1} 月 {headerDate.getDate()} 日　|　本周自 {fmtCN(wkStart)} 起
            </NavArrows>
            <div className="mt-1 print:hidden flex justify-center">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 border border-black/60 bg-white text-black hover:bg-neutral-100"
                  >
                    <CalendarIcon className="h-3 w-3" />
                    选择主日
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={headerDate}
                    onSelect={(d) => {
                      if (!d) return;
                      const s = toISO(currentSundayOf(d));
                      setHeaderSunday(s); setDutySunday(s); setAttSunday(s); setCourseSunday(s); setFellowSunday(s);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 print:grid-cols-3 text-[17px] leading-[1.55] items-stretch">
          {/* 左栏 */}
          <div className="break-inside-avoid md:pr-4 flex flex-col h-full gap-4">
            <Block
              title="圣工轮值表（今日）"
              onPrev={() => setDutySunday(shiftSunday(dutySunday, -1))}
              onNext={() => setDutySunday(shiftSunday(dutySunday, 1))}
            >
              <div className="text-[12px] text-neutral-600 text-center mb-1">
                {(() => { const d = new Date(dutySunday + "T00:00:00"); return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; })()}
              </div>
              {editing ? (
                <Editor value={editDuty.duty} editing={editing} onChange={(v) => updateForDate(dutySunday, { duty: v })} />
              ) : (
                <DutyList value={editDuty.duty} hasData={!!byDate[dutySunday]} />
              )}
            </Block>
            <div className="flex-1" aria-hidden />
            <Block title="儿童事工">
              <table className="bulletin-table kids-table w-full">
                <thead>
                  <tr>
                    <th className="border text-center font-semibold">时间</th>
                    <th className="border text-center font-semibold">年级/级别</th>
                    <th className="border text-center font-semibold">教室</th>
                    <th className="border text-center font-semibold">负责同工</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const now = new Date(headerSunday + "T00:00:00");
                    const year = now.getFullYear();
                    // 1-8 月读取春季，9-12 月读取秋季
                    const season = now.getMonth() + 1 <= 8 ? "spring" : "fall";
                    const trackKey = `kids_${season}_${year}`;
                    const rows = (kidsClasses ?? [])
                      .filter((c) => c.track === trackKey)
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                    if (rows.length === 0) {
                      return (
                        <tr>
                          <td className="border text-center text-neutral-500 py-2" colSpan={4}>
                            暂无{season === "spring" ? "春季" : "秋季"}儿童主日学班级数据
                          </td>
                        </tr>
                      );
                    }
                    return rows.map((r, i) => (
                      <tr key={r.id ?? i}>
                        {i === 0 && (
                          <td className="border text-center align-middle whitespace-nowrap" rowSpan={rows.length}>
                            <div>11:00am–12:30pm</div>
                            <div>儿童主日学</div>
                          </td>
                        )}
                        <td className="border whitespace-nowrap">{r.class_name?.trim() || r.course_name?.trim() || "—"}</td>
                        <td className="border text-center whitespace-nowrap">{r.class_location?.trim() || "—"}</td>
                        <td className="border text-center whitespace-nowrap">{r.teacher_name?.trim() || "—"}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </Block>
            <div className="flex-1" aria-hidden />
            <Block
              title={`上周人数统计（${attSunday}）`}
              onPrev={() => setAttSunday(shiftSunday(attSunday, -1))}
              onNext={() => setAttSunday(shiftSunday(attSunday, 1))}
            >
              {attRecord ? (
                <table className="bulletin-table w-full">
                  <tbody>
                    <Row k="大堂敬拜" v={String(attRecord.worship_count)} />
                    <Row k="儿童学生" v={String(attRecord.children_students)} />
                    <Row k="儿童老师" v={String(attRecord.children_teachers)} />
                    <Row k="总数" v={String(attRecord.worship_count + attRecord.children_students + attRecord.children_teachers)} />
                  </tbody>
                </table>
              ) : <div className="text-center text-[14px] py-2 text-neutral-500">暂无该主日人数统计</div>}
            </Block>
            <div className="flex-1" aria-hidden />
          </div>

          {/* 中栏 */}
          <div className="break-inside-avoid md:px-4 flex flex-col h-full">
            <div
              className="text-center pb-1 mb-2 tracking-[0.12em] text-[20px]"
              style={{ fontFamily: "'STZhongsong','STSong','SimSun',serif", fontWeight: 700 }}
            >
              中文堂主日敬拜程序
            </div>
            <h3 className="section-title text-[20px] tracking-[0.1em] text-center pb-0.5 mb-1.5">
              今日主日崇拜
            </h3>
            <div className="flex-1 flex flex-col">
              {editing ? (
                <WorshipProgramEditor
                  program={currentProgram}
                  onChange={updateProgramField}
                  onCopyLastWeek={copyFromLastWeek}
                />
              ) : (
                <WorshipProgramView program={currentProgram} />
              )}
            </div>
          </div>

          {/* 右栏 */}
          <div className="space-y-4 break-inside-avoid md:pl-4 flex flex-col h-full">
            <Block
              title="成人主日学课程"
              onPrev={() => setCourseSunday(shiftSunday(courseSunday, -1))}
              onNext={() => setCourseSunday(shiftSunday(courseSunday, 1))}
            >
              {courses.length > 0 ? (
                <>
                  <div className="space-y-0.5">
                    {courses.slice(0, 12).map((c) => {
                      const cnt = courseSundayCheckins.filter((s) => s.course_name === c.name).length;
                      return <BulletinLine key={c.id} left={c.name} right={cnt > 0 ? `（${cnt}人）` : `（待统计）`} />;
                    })}
                  </div>
                  <BulletinLine left="该主日签到合计" right={`${courseSundayCheckins.length} 人`} />
                </>
              ) : (
                <div className="text-center text-[14px] py-2 text-neutral-500">暂无该主日成人主日学课程</div>
              )}
              <div className="text-[12px] text-neutral-500 text-center mt-1">{courseSunday}</div>
            </Block>
            <div className="flex-1" aria-hidden />
            <Block
              title="团契 / 小组聚会"
              onPrev={() => setFellowSunday(shiftSunday(fellowSunday, -1))}
              onNext={() => setFellowSunday(shiftSunday(fellowSunday, 1))}
            >
              {(() => {
                if (fellowships.length === 0) {
                  return <div className="text-center text-[14px] py-2 text-neutral-500">暂无该周团契 / 小组聚会资料</div>;
                }
                const rows = fellowships.slice(0, 14).map((f) => {
                  const cnt = fellowshipCheckins.filter((c) => c.fellowship === f.name && fellowMatches(f.name, c.checkin_date)).length;
                  return { name: f.name, id: f.id, cnt };
                });
                return (
                  <div className="space-y-0.5">
                    {rows.map((r) => (
                      <BulletinLine key={r.id} left={r.name} right={r.cnt > 0 ? `（${r.cnt}人）` : `（本周无聚会）`} />
                    ))}
                  </div>
                );
              })()}
              <div className="text-[12px] text-neutral-500 text-center mt-1">
                {fellowSunday}（{toISO(fellowRangeStart)} ~ {toISO(fellowRangeEnd)}）
              </div>
            </Block>
          </div>
        </div>
      </div>

      <style>{`
        #elder-bulletin .section-title {
          font-family: 'KaiTi','DFKai-SB','BiauKai','STKaiti','SimSun',serif;
          font-weight: 700;
        }
        #elder-bulletin b, #elder-bulletin strong { font-weight: 700; }
        #elder-bulletin .bln-row {
          display: flex;
          align-items: baseline;
          gap: 0.4em;
          line-height: 1.7;
        }
        #elder-bulletin .bln-left { white-space: nowrap; flex-shrink: 0; }
        #elder-bulletin .bln-mid {
          flex: 1;
          border-bottom: 1px dotted #000;
          transform: translateY(-0.35em);
          min-width: 1.5em;
        }
        #elder-bulletin .bln-mid-text {
          flex: 0 1 auto;
          color: #000;
          padding: 0 0.3em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #elder-bulletin .bln-right { white-space: nowrap; flex-shrink: 0; text-align: right; }
        #elder-bulletin .bulletin-table {
          border-collapse: collapse;
          font-family: 'PMingLiU','MingLiU','SimSun',serif;
          font-weight: 700;
        }
        #elder-bulletin .bulletin-table td,
        #elder-bulletin .bulletin-table th {
          font-size: 17px;
          line-height: 1.45;
          padding: 4px 8px;
          border: 1px solid #000;
          font-weight: 600;
        }
        #elder-bulletin .kids-table { table-layout: auto; }
        #elder-bulletin .kids-table td,
        #elder-bulletin .kids-table th {
          font-size: 8px;
          line-height: 1.3;
          padding: 2px 3px;
          font-weight: 600;
        }
        #elder-bulletin .latin-text {
          font-family: 'Times New Roman','PMingLiU',serif;
          font-weight: 700;
        }
        #elder-bulletin .bulletin-table td.text-right.latin-text {
          font-size: 18px;
        }
        @media print {
          body * { visibility: hidden !important; }
          #elder-bulletin, #elder-bulletin * { visibility: visible !important; }
          #elder-bulletin { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </section>
  );
}

function Block({ title, children, onPrev, onNext }: { title: string; children: React.ReactNode; onPrev?: () => void; onNext?: () => void }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="section-title text-[20px] tracking-[0.1em] text-center pb-0.5 mb-1.5">
        {onPrev && onNext ? (
          <NavArrows onPrev={onPrev} onNext={onNext}>{title}</NavArrows>
        ) : title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td>{k}</td>
      <td className="text-right tabular-nums latin-text">{v}</td>
    </tr>
  );
}

const DUTY_LABELS = [
  "讲员", "司会", "领诗", "司琴", "招待", "新人接待",
  "圣餐服事", "餐前投影", "视频播放", "厨房服事", "堂务", "插花",
];

function isEmptyDutyValue(v: string) {
  const t = v.trim();
  if (!t) return true;
  if (/^[—–\-_\s]+$/.test(t)) return true;
  return false;
}

function DutyList({ value, hasData }: { value: string; hasData: boolean }) {
  const map = new Map<string, string>();
  value.split("\n").forEach((ln) => {
    const m = ln.match(/^\s*([^：:]+)[：:](.*)$/);
    if (m) map.set(m[1].trim(), m[2].trim());
  });
  return (
    <div className="space-y-0.5">
      {DUTY_LABELS.map((label) => {
        const raw = map.get(label) ?? "";
        const val = hasData && !isEmptyDutyValue(raw) ? raw : "待定";
        return <BulletinLine key={label} left={label} right={`（${val}）`} />;
      })}
    </div>
  );
}

/** Split a bulletin line into left / mid / right segments using common
 * separators found in printed church bulletins. */
function splitBulletinLine(raw: string): { left: string; mid: string; right: string } | null {
  const line = raw.trim();
  if (!line) return null;
  // Try ellipsis-style separators first
  const ellipsisRe = /…{1,}|\.{3,}/g;
  const parts = line.split(ellipsisRe).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const left = parts[0];
    const right = parts[parts.length - 1];
    const mid = parts.slice(1, -1).join(" ");
    return { left, mid, right };
  }
  // Fallback: split by Chinese / ASCII colon — keep last segment as the right side
  const colonRe = /[：:]/;
  if (colonRe.test(line)) {
    const idx = line.search(colonRe);
    return { left: line.slice(0, idx).trim(), mid: "", right: line.slice(idx + 1).trim() };
  }
  return null;
}

function BulletinLine({ left, mid, right }: { left: string; mid?: string; right: string }) {
  return (
    <div className="bln-row">
      <span className="bln-left">{left}</span>
      <span className="bln-mid" aria-hidden />
      {mid ? (
        <>
          <span className="bln-mid-text">{mid}</span>
          <span className="bln-mid" aria-hidden />
        </>
      ) : null}
      <span className="bln-right">{right || "\u00A0"}</span>
    </div>
  );
}

function BulletinBlock({ value, stretch }: { value: string; stretch?: boolean }) {
  const lines = value.split("\n");
  let n = 0;
  return (
    <div className={stretch ? "flex flex-col justify-between h-full" : undefined}>
      {lines.map((ln, i) => {
        const trimmed = ln.trim();
        if (trimmed.startsWith("#")) {
          const text = trimmed.replace(/^#+\s*/, "");
          return (
            <div
              key={i}
              className="text-center my-2 tracking-[0.15em]"
              style={{ fontWeight: 700 }}
            >
              {text}
            </div>
          );
        }
        if (trimmed.startsWith(">")) {
          const text = trimmed.replace(/^>\s*/, "");
          return (
            <div
              key={i}
              className="mt-3 leading-[1.6] text-[15px]"
              style={{ fontWeight: 600 }}
            >
              {text}
            </div>
          );
        }
        const parts = splitBulletinLine(ln);
        if (!parts) {
          return (
            <div key={i} className="whitespace-pre-wrap">{ln || "\u00A0"}</div>
          );
        }
        n += 1;
        return (
          <BulletinLine
            key={i}
            left={`${n}. ${parts.left}`}
            mid={parts.mid}
            right={parts.right}
          />
        );
      })}
    </div>
  );
}

function Editor({ value, editing, onChange, stretch }: { value: string; editing: boolean; onChange: (v: string) => void; stretch?: boolean }) {
  if (editing) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(16, Math.max(3, value.split("\n").length + 1))}
        className={`w-full border border-dashed border-black/30 p-1 text-[12px] bg-white print:bg-white print:border-0 ${stretch ? "flex-1 min-h-[300px]" : ""}`}
        style={{ fontFamily: "inherit" }}
      />
    );
  }
  if (stretch) {
    return (
      <div
        className="flex-1 flex flex-col text-[17px] leading-[1.55]"
        style={{ fontFamily: "inherit", minHeight: "100%" }}
      >
        <BulletinBlock value={value} stretch />
      </div>
    );
  }
  return <BulletinBlock value={value} />;
}

/** 按 7 个固定项目拼装并以三段式（左 · 虚线 · 右）渲染敬拜程序 */
function WorshipProgramView({ program }: { program: WorshipProgram }) {
  return (
    <div className="flex flex-col">
      {(() => {
        let n = 0;
        return PROGRAM_TEMPLATE.map((row, i) => {
          if (row.kind === "section") {
            return (
              <div
                key={i}
                className="text-center my-2 tracking-[0.15em]"
                style={{ fontWeight: 700 }}
              >
                {row.text}
              </div>
            );
          }
          n += 1;
          if (row.kind === "fixed") {
            return <BulletinLine key={i} left={`${n}. ${row.left}`} right={row.right} />;
          }
          const mid = (program[row.key] || "").trim() || "________";
          return <BulletinLine key={i} left={`${n}. ${row.left}`} mid={mid} right={row.right} />;
        });
      })()}
    </div>
  );
}

/** 后台编辑：仅 7 个可变项目，每项独立输入 + 复制上周内容 */
function WorshipProgramEditor({
  program,
  onChange,
  onCopyLastWeek,
}: {
  program: WorshipProgram;
  onChange: (k: keyof WorshipProgram, v: string) => void;
  onCopyLastWeek: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-2 border border-dashed border-black/30 bg-white print:hidden">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCopyLastWeek}
          className="text-[12px] px-2 py-0.5 border border-black/60 bg-white text-black hover:bg-neutral-100"
        >
          复制上周内容
        </button>
      </div>
      {WORSHIP_FIELDS.map((f) => (
        <div key={f.key} className="flex items-center gap-2">
          <label className="text-[13px] w-20 shrink-0 text-right">{f.label}：</label>
          <Input
            defaultValue={program[f.key] ?? ""}
            placeholder={f.placeholder}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (program[f.key] ?? "")) onChange(f.key, v);
            }}
            className="h-8 text-[13px]"
          />
          <span className="text-[12px] text-neutral-500 w-10 shrink-0">{f.role}</span>
        </div>
      ))}
      <div className="text-[11px] text-neutral-500 mt-1">
        其余固定项目（默祷 / 牧祷 / 奉献祷告 / 三一颂 / 祝福 / 报告 / 默祷）由系统自动填充，无需编辑。失焦自动保存。
      </div>
    </div>
  );
}

/**
 * 自动缩放字号以避免内容溢出父容器。
 * 从 max 起逐 px 递减直到内容不再溢出或达到 min。
 */
function AutoFit({
  children,
  className,
  min = 11,
  max = 17,
}: {
  children: React.ReactNode;
  className?: string;
  min?: number;
  max?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number>(max);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    let s = max;
    inner.style.fontSize = s + "px";
    // 多次量测，避免字体未渲染完导致结果不准。
    let guard = 40;
    while (s > min && inner.scrollHeight > wrap.clientHeight && guard-- > 0) {
      s -= 1;
      inner.style.fontSize = s + "px";
    }
    setSize(s);
  }, [children, max, min]);

  return (
    <div ref={wrapRef} className={className} style={{ overflow: "hidden" }}>
      <div ref={innerRef} style={{ fontSize: size + "px", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}
