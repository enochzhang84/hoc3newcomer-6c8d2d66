import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { submitRetreatRegistration } from "@/lib/retreat.functions";

export const Route = createFileRoute("/retreat-register")({
  component: RetreatRegisterPage,
});

export const ENCOURAGE_VERSES = [
  { text: "你要专心仰赖耶和华，不可倚靠自己的聪明。", ref: "箴言 3:5" },
  { text: "我靠着那加给我力量的，凡事都能做。", ref: "腓立比书 4:13" },
  { text: "耶和华是我的牧者，我必不致缺乏。", ref: "诗篇 23:1" },
  { text: "凡劳苦担重担的人，可以到我这里来，我就使你们得安息。", ref: "马太福音 11:28" },
  { text: "神爱世人，甚至将他的独生子赐给他们。", ref: "约翰福音 3:16" },
  { text: "神所赐出人意外的平安，必在基督耶稣里保守你们的心怀意念。", ref: "腓立比书 4:7" },
  { text: "我留下平安给你们，我将我的平安赐给你们。", ref: "约翰福音 14:27" },
  { text: "应当一无挂虑，只要凡事藉着祷告、祈求和感谢，将你们所要的告诉神。", ref: "腓立比书 4:6" },
  { text: "你们要先求他的国和他的义，这些东西都要加给你们了。", ref: "马太福音 6:33" },
  { text: "神能将各样的恩惠多多地加给你们。", ref: "哥林多后书 9:8" },
];

export function pickVerse() {
  return ENCOURAGE_VERSES[Math.floor(Math.random() * ENCOURAGE_VERSES.length)];
}

const CHURCHES = ["hoc1", "hoc2", "hoc3", "hoc4", "hoc5", "hoc6", "hoc7"];
const PROGRAMS: { v: string; label: string }[] = [
  { v: "M", label: "M — 中文 (Chinese)" },
  { v: "E", label: "E — 英文 (English)" },
  { v: "N", label: "N — 9~11 岁" },
  { v: "S", label: "S — 7~8 岁" },
  { v: "F", label: "F — 5~6 岁" },
  { v: "T", label: "T — 4 岁" },
  { v: "R", label: "R — 3 岁" },
  { v: "B", label: "B — 0~2 岁" },
];
const TOPICS = [
  "1 - 迎接老年时代的来临 - 一个基督徒的立场 - 廖俊惠医师主讲",
  "2 - 婚姻成长 DIY / 陪孩子走一段路 - 郭磊土疏师母",
  "3 - 走过悲伤与忧郁：信仰中的关键与盼望 - 林慈敏博士主讲",
  "4 - 如何在 AI 热潮、高关税、股市高点下做个福音理财好管家 - 陈少豪牧师主讲",
];

function BiLabel({ cn, en, required }: { cn: string; en: string; required?: boolean }) {
  return (
    <Label className="flex flex-col items-start gap-0.5">
      <span>
        {cn} {required && <span className="text-destructive">*</span>}
      </span>
      <span className="text-xs font-normal text-muted-foreground">{en}</span>
    </Label>
  );
}

function RetreatRegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ verse: { text: string; ref: string }; numbers: string[] } | null>(null);
  const submit = useServerFn(submitRetreatRegistration);

  type Person = {
    chinese_name: string;
    last_name: string;
    first_name: string;
    gender: string;
    cell: string;
    email: string;
    program: string;
    topic: string;
    bed: string;
    user_notes: string;
  };
  const blankPerson = (): Person => ({
    chinese_name: "", last_name: "", first_name: "", gender: "",
    cell: "", email: "", program: "", topic: "", bed: "", user_notes: "",
  });

  const [shared, setShared] = useState({
    church: "hoc3",
    can_pickup: "",
    need_pickup: "",
  });
  const [main, setMain] = useState<Person>(blankPerson());
  const [companions, setCompanions] = useState<Person[]>([]);

  const updatePerson = (
    setter: (p: Person) => void,
    current: Person,
  ) => <K extends keyof Person>(k: K, v: Person[K]) => setter({ ...current, [k]: v });

  const updateCompanion = (idx: number, patch: Partial<Person>) => {
    setCompanions((arr) => arr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!main.chinese_name.trim()) {
      toast.error("请填写中文姓名 / Please enter Chinese name");
      return;
    }
    for (let i = 0; i < companions.length; i++) {
      if (!companions[i].chinese_name.trim()) {
        toast.error(`随行人 #${i + 1} 请填写中文姓名`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const toPayload = (p: Person) => ({
        chinese_name: p.chinese_name.trim(),
        last_name: p.last_name.trim() || null,
        first_name: p.first_name.trim() || null,
        gender: p.gender || null,
        cell: p.cell.trim() || null,
        email: p.email.trim() || null,
        program: p.program || null,
        topic: p.topic || null,
        bed: p.bed || null,
        user_notes: p.user_notes.trim() || null,
      });
      const res = await submit({
        data: {
          church: shared.church || null,
          can_pickup: parseInt(shared.can_pickup || "0", 10) || null,
          need_pickup: parseInt(shared.need_pickup || "0", 10) || null,
          main: toPayload(main),
          companions: companions.map(toPayload),
        },
      });
      setDone({ verse: pickVerse(), numbers: res.confirmation_numbers });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setShared({ church: "hoc3", can_pickup: "", need_pickup: "" });
    setMain(blankPerson());
    setCompanions([]);
    setDone(null);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full bg-card border border-border/50 rounded-2xl p-8 text-center shadow-xl">
          <img src={logo} alt="" className="h-12 w-12 mx-auto mb-3 object-contain" />
          <h1 className="font-serif text-2xl mb-2">登记成功 · Thank You!</h1>
          <p className="text-sm text-muted-foreground mb-6">
            愿主赐福你 · May the Lord bless you
          </p>
          {done.numbers.length > 0 && (
            <div className="mb-6 bg-muted/40 border border-border/50 rounded-xl p-4 text-left">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Confirmation #</p>
              <ul className="font-mono text-sm space-y-1">
                {done.numbers.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          )}
          <blockquote className="border-l-4 border-primary/60 pl-4 text-left italic text-foreground/90 leading-relaxed mb-6">
            「{done.verse.text}」
            <div className="mt-1 text-sm text-muted-foreground not-italic">— {done.verse.ref}</div>
          </blockquote>
          <div className="flex gap-3 justify-center">
            <Link to="/retreat">
              <Button variant="outline">返回</Button>
            </Link>
            <Button onClick={resetAll}>
              再次登记
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/retreat" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
            <span className="font-serif text-lg">退修会登记 · Retreat Registration</span>
          </Link>
          <Link to="/retreat"><Button variant="ghost" size="sm">返回</Button></Link>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-2 items-start max-w-6xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 space-y-5 order-1 lg:order-1">
          <h1 className="font-serif text-2xl mb-1">2026 基督之家联合退修会</h1>
          <p className="text-sm text-muted-foreground mb-2">
            The Home of Christ Church Joint Retreat — Registration Form
          </p>

          <div>
            <BiLabel cn="基督之家分堂" en="HOC Campus" />
            <select
              value={shared.church}
              onChange={(e) => setShared({ ...shared, church: e.target.value })}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {CHURCHES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </div>

          <PersonFields
            heading="主要登记人 · Primary Registrant"
            value={main}
            onChange={(patch) => setMain({ ...main, ...patch })}
            requireName
          />

          {companions.map((p, idx) => (
            <PersonFields
              key={idx}
              heading={`随行人 #${idx + 1} · Companion ${idx + 1}`}
              value={p}
              onChange={(patch) => updateCompanion(idx, patch)}
              onRemove={() => setCompanions((arr) => arr.filter((_, i) => i !== idx))}
              requireName
            />
          ))}

          {companions.length < 6 && (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setCompanions((arr) => [...arr, blankPerson()])}
            >
              + 添加随行人 · Add Companion ({companions.length}/6)
            </Button>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <BiLabel cn="我们可以接送______位" en="We can pick up ___ people" />
              <Input
                type="number"
                min={0}
                value={shared.can_pickup}
                onChange={(e) => setShared({ ...shared, can_pickup: e.target.value })}
                className="mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <BiLabel cn="我们有______位需要被接送" en="We need pick-up for ___ people" />
              <Input
                type="number"
                min={0}
                value={shared.need_pickup}
                onChange={(e) => setShared({ ...shared, need_pickup: e.target.value })}
                className="mt-1"
                placeholder="0"
              />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full rounded-full" size="lg">
            {submitting ? "提交中…" : `提交登记 · Submit (${1 + companions.length} 人)`}
          </Button>
        </form>
        <aside className="order-2 lg:order-2 space-y-5 lg:sticky lg:top-6">
          {/* 1 — 标题 */}
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <h2 className="font-serif text-2xl text-center leading-tight">2026 基督之家联合退修会</h2>
            <p className="text-center text-sm text-muted-foreground mt-1">
              The Home of Christ Church Joint Retreat Conference
            </p>
            <p className="text-center text-sm mt-2">报名表 · Registration Form</p>
          </div>
          {/* 2 — 主题 / 讲员 */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">中文部</p>
              <p>主题：跨越—萬國萬代</p>
              <p>讲员：柏有成博士</p>
            </div>
            <div>
              <p className="font-medium mb-1">English Ministry</p>
              <p>Theme: —</p>
              <p>Speaker: Pastor</p>
            </div>
          </div>
          {/* 3 — 中文部专题 */}
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <p className="font-medium text-sm mb-2">中文部专题讲题和讲员</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
              <li>週六：迎接老年时代的来临—一个基督徒的立场（廖俊惠医师）</li>
              <li>週六：婚姻成长 DIY / 陪孩子走一段路（郭颜上琉师母）</li>
              <li>週六：走过悲伤与忧鬱—信仰中的关顾与盼望（林慈敏博士）</li>
              <li>週六：如何在 AI 热潮、高关税、股市高点下，做幸福理财好管家（陈少豪牧师）</li>
            </ol>
          </div>
          {/* 4 — 注意事项 / 会址 */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 text-sm space-y-2">
            <p className="font-medium">日期与地点 · Date &amp; Venue</p>
            <p>7/24 Fri 1:00PM — 7/26 Sun 1:00PM</p>
            <p>Sonoma State University<br/>1801 E. Cotati Ave., Rohnert Park, CA 94928</p>
            <p className="text-xs text-muted-foreground">Tel: 707-664-2527 · www.sonoma.edu/cec</p>
            <hr className="my-2 border-border/60" />
            <p className="font-medium">填表说明 · Instructions</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              <li>请按夫、妻、子女、朋友等顺序填写，填写在同一张报名表的人将尽量被安排在同一栋宿舍。Everyone in this form will likely be assigned to the same apartment unit.</li>
              <li>请在黑体栏目中填入必需的信息。Please provide required information in the columns with bold headings.</li>
            </ul>
            <hr className="my-2 border-border/60" />
            <p className="font-medium">注意事项</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              <li>报名网址：http://hoc.org（login: hoc1/hoc1, hoc2/hoc2, hoc3/hoc3, hoc4/hoc4, hoc5/hoc5, hoc6/hoc6, hoc7/hoc7）。</li>
              <li>报名费用：2026/7/15 前，未满 4 岁免费；4–11 岁不占床位 $110，占床位 $180；12 岁以上必需占床位。预估每人 $308。</li>
              <li>报名截止：6/30/2026，先到先得，额满即止。</li>
              <li>保险规定：未满 18 岁父母未同行者，请填 Medical &amp; Liability Release Form，与报名表、报名费一同缴上。</li>
              <li>节目简介：今年分中文堂、英文堂，3–11 岁儿童由老师带领，0–2 岁儿童由家长照顾。</li>
              <li>节目代码：中文(M)、英文(E)、9–11岁(N)、7–8岁(S)、5–6岁(F)、4岁(T)、3岁(R)、0–2岁(B)。</li>
              <li>交通安排：我们可以接送 ___ 位；我们有 ___ 位需要被接送。</li>
              <li>携带物品：圣经、笔、漱洗用具、日用衣物、常用药品、游泳衣、手电筒、运动器材等。SSU 提供寝具，但不占床位的儿童请自备睡袋。</li>
            </ul>
            <hr className="my-2 border-border/60" />
            <p className="font-medium">会址简介 · About SSU</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sonoma 州立大学（简称 SSU）位于 Sonoma 山谷，风景优美，气候宜人。校区在旧金山以北约五十英里，由南湾启程约为二小时的车程。
            </p>
            <p className="font-medium mt-2">住宿规定 · Accommodation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              SSU 今年提供我们最佳套房式的住宿，每套房均有两间单人房及两间双人房，每间均有自用的浴厕设备。SSU 会为我们准备床单、毛毯、手巾、浴巾、香皂等。每四个房间为一单元，共用客厅、餐厅、厨房及冰箱微波炉等，在报名时可将此因素考虑在内。请注意保持住处特别是厨房的清洁，若被徵收清洁费，将由各人自行负责。请遵守 SSU 及大会规定。
            </p>
          </div>
        </aside>
        </div>
      </main>
    </div>
  );
}