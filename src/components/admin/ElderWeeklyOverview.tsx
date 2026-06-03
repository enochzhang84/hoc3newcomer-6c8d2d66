import { useMemo, useState, useEffect } from "react";

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

export type ElderOverviewProps = {
  regs: Reg[];
  attendance: Attendance[];
  sundayCheckins: SundayCheckin[];
  fellowshipCheckins: FellowshipCheckin[];
  courses: Course[];
  fellowships: Fellowship[];
  mealPlans: MealPlan[];
  onRefresh?: () => void;
};

const LS_KEY = "elder.weekly.overview.v1";

type Editable = {
  duty: string;
  kids: string;
  worship: string;
  newsletter: string;
  prayer: string;
  offerings: string;
};

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
    "宣召……诗篇 ____……司会",
    "默祷……会众",
    "唱诗……教会圣诗 ____……会众",
    "牧祷……牧师",
    "献诗……当敬拜耶和华……诗班",
    "经文诵读……____……会众",
    "讲训……____……会众",
    "信息……____……牧师",
    "奉献诗歌……教会圣诗 ____……会众",
    "奉献祷告……司会",
    "三一颂……会众",
    "祝福……长老",
    "报告……司会",
    "默祷……会众",
  ].join("\n"),
  newsletter: "本周家讯：————",
  prayer: "祷告事项：————",
  offerings: "Check：$ ____\nZelle：$ ____\nAR：$ ____\nCash：$ ____\nTotal：$ ____",
};

function loadEditable(): Editable {
  if (typeof window === "undefined") return DEFAULT_EDITABLE;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_EDITABLE;
    return { ...DEFAULT_EDITABLE, ...(JSON.parse(raw) as Partial<Editable>) };
  } catch {
    return DEFAULT_EDITABLE;
  }
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
function sameLocalDate(iso: string, day: Date) {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

export function ElderWeeklyOverview(props: ElderOverviewProps) {
  const { regs, attendance, sundayCheckins, fellowshipCheckins, courses, fellowships, mealPlans, onRefresh } = props;
  const [edit, setEdit] = useState<Editable>(() => loadEditable());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(edit)); } catch {}
  }, [edit]);

  const today = useMemo(() => new Date(), []);
  const wkStart = useMemo(() => startOfWeek(today), [today]);

  // 今日新人
  const todayNewcomers = regs.filter((r) => sameLocalDate(r.created_at, today));
  // 上周人数统计：取最近一条 attendance
  const latest = attendance[0];
  // 本周饭食
  const weekMeals = mealPlans.filter((m) => new Date(m.plan_date) >= wkStart);
  const weekMealCount = weekMeals.reduce((s, m) => s + (m.attendees ?? 0), 0);
  // 主日学今日签到
  const todaySS = sundayCheckins.filter((c) => sameLocalDate(c.checkin_date, today));
  // 团契本周参与
  const weekFellow = fellowshipCheckins.filter((c) => new Date(c.checkin_date) >= wkStart);

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
        className="bg-white text-black border border-black p-4 print:p-2 print:border-0"
        style={{ fontFamily: "'Songti SC','SimSun','宋体','PMingLiU','新细明体',serif" }}
      >
        <div className="text-center pb-2 mb-3 border-b border-black">
          <div className="text-[15px] tracking-[0.4em] pl-[0.4em]">基督之家第三家</div>
          <div className="text-[22px] font-bold tracking-[0.3em] pl-[0.3em] mt-1">今 日 周 报 总 览</div>
          <div className="text-[11px] mt-1 tracking-widest">
            主后 {today.getFullYear()} 年 {today.getMonth() + 1} 月 {today.getDate()} 日　|　本周自 {fmtCN(wkStart)} 起
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 print:grid-cols-3 text-[12px] leading-[1.55] [&>div+div]:md:border-l-0">
          {/* 左栏 */}
          <div className="border border-black p-2 space-y-2 break-inside-avoid md:border-r-0">
            <Block title="圣工轮值表（今日）">
              <Editor value={edit.duty} editing={editing} onChange={(v) => setEdit({ ...edit, duty: v })} />
            </Block>
            <Block title="儿童事工">
              <Editor value={edit.kids} editing={editing} onChange={(v) => setEdit({ ...edit, kids: v })} />
            </Block>
            <Block title={`上周人数统计${latest ? `（${latest.record_date}）` : ""}`}>
              {latest ? (
                <table className="w-full border-collapse text-[12px]">
                  <tbody>
                    <Row k="大堂敬拜" v={String(latest.worship_count)} />
                    <Row k="儿童学生" v={String(latest.children_students)} />
                    <Row k="儿童老师" v={String(latest.children_teachers)} />
                    <Row k="总数" v={String(latest.worship_count + latest.children_students + latest.children_teachers)} />
                  </tbody>
                </table>
              ) : <div className="text-gray-600">暂无数据</div>}
            </Block>
            <Block title="本周饭食 / 奉献统计">
              <div className="mb-1">本周饭食人数：<b>{weekMealCount}</b>（{weekMeals.length} 餐）</div>
              <Editor value={edit.offerings} editing={editing} onChange={(v) => setEdit({ ...edit, offerings: v })} />
            </Block>
          </div>

          {/* 中栏 */}
          <div className="border border-black p-2 space-y-2 break-inside-avoid md:border-r-0">
            <div className="text-center font-bold border-b border-black pb-1 mb-1 tracking-[0.3em] pl-[0.3em]">
              中文堂主日敬拜程序
            </div>
            <Block title="今日主日崇拜">
              <Editor value={edit.worship} editing={editing} onChange={(v) => setEdit({ ...edit, worship: v })} />
            </Block>
            <Block title="今日新人登记">
              <div className="mb-1">今日新人：<b>{todayNewcomers.length}</b> 人</div>
              {todayNewcomers.length > 0 && (
                <ul className="list-disc pl-4">
                  {todayNewcomers.slice(0, 12).map((r) => (
                    <li key={r.id}>{r.name ?? "—"}</li>
                  ))}
                </ul>
              )}
            </Block>
          </div>

          {/* 右栏 */}
          <div className="border border-black p-2 space-y-2 break-inside-avoid">
            <Block title="成人主日学课程">
              {courses.length > 0 ? (
                <ul className="list-disc pl-4">
                  {courses.slice(0, 12).map((c) => {
                    const cnt = todaySS.filter((s) => s.course_name === c.name).length;
                    return <li key={c.id}>{c.name}{cnt > 0 ? `（今日 ${cnt} 人）` : ""}</li>;
                  })}
                </ul>
              ) : <div className="text-gray-600">暂无课程</div>}
              <div className="mt-1">今日主日学签到合计：<b>{todaySS.length}</b> 人</div>
            </Block>
            <Block title="团契 / 小组聚会">
              {fellowships.length > 0 ? (
                <ul className="list-disc pl-4">
                  {fellowships.slice(0, 14).map((f) => {
                    const cnt = weekFellow.filter((c) => c.fellowship === f.name).length;
                    return <li key={f.id}>{f.name}{cnt > 0 ? `（本周 ${cnt} 人）` : ""}</li>;
                  })}
                </ul>
              ) : <div className="text-gray-600">暂无团契</div>}
            </Block>
            <Block title="本周家讯">
              <Editor value={edit.newsletter} editing={editing} onChange={(v) => setEdit({ ...edit, newsletter: v })} />
            </Block>
            <Block title="祷告事项">
              <Editor value={edit.prayer} editing={editing} onChange={(v) => setEdit({ ...edit, prayer: v })} />
            </Block>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #elder-bulletin, #elder-bulletin * { visibility: visible !important; }
          #elder-bulletin { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-bold text-center border-b border-black pb-0.5 mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="border border-black px-1 py-0.5">{k}</td>
      <td className="border border-black px-1 py-0.5 text-right tabular-nums">{v}</td>
    </tr>
  );
}

function Editor({ value, editing, onChange }: { value: string; editing: boolean; onChange: (v: string) => void }) {
  if (editing) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(16, Math.max(3, value.split("\n").length + 1))}
        className="w-full border border-black p-1 text-[12px] font-mono bg-yellow-50 print:bg-white"
      />
    );
  }
  return <pre className="whitespace-pre-wrap font-sans text-[12px] leading-snug m-0">{value}</pre>;
}
