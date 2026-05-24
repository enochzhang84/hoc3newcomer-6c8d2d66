import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

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
  "1 — 迎接老年时代的来临 (廖俊惠医师)",
  "2 — 婚姻成长 DIY / 陪孩子走一段路 (郭颜上琉师母)",
  "3 — 走过悲伤与忧鬱 (林慈敏博士)",
  "4 — 如何在 AI、高关税、股市高点下做好管家 (陈少豪牧师)",
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
  const [done, setDone] = useState<{ verse: { text: string; ref: string } } | null>(null);
  const [form, setForm] = useState({
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
    user_notes: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.chinese_name.trim()) {
      toast.error("请填写中文姓名 / Please enter Chinese name");
      return;
    }
    setSubmitting(true);
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
      user_notes: form.user_notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone({ verse: pickVerse() });
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
          <blockquote className="border-l-4 border-primary/60 pl-4 text-left italic text-foreground/90 leading-relaxed mb-6">
            「{done.verse.text}」
            <div className="mt-1 text-sm text-muted-foreground not-italic">— {done.verse.ref}</div>
          </blockquote>
          <div className="flex gap-3 justify-center">
            <Link to="/retreat">
              <Button variant="outline">返回</Button>
            </Link>
            <Button onClick={() => { setDone(null); setForm({ ...form, chinese_name: "", last_name: "", first_name: "", cell: "", email: "", user_notes: "" }); }}>
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
      <main className="container mx-auto px-6 py-10 max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 space-y-5">
          <h1 className="font-serif text-2xl mb-1">2026 基督之家联合退修会</h1>
          <p className="text-sm text-muted-foreground mb-2">
            The Home of Christ Church Joint Retreat — Registration Form
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <BiLabel cn="基督之家分堂" en="HOC Campus" />
              <select
                value={form.church}
                onChange={(e) => set("church", e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {CHURCHES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <BiLabel cn="性别" en="Gender" />
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                <option value="M">M (男 / Male)</option>
                <option value="F">F (女 / Female)</option>
              </select>
            </div>
          </div>

          <div>
            <BiLabel cn="中文姓名" en="Chinese Name" required />
            <Input value={form.chinese_name} onChange={(e) => set("chinese_name", e.target.value)} className="mt-1" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <BiLabel cn="英文姓 (Last name)" en="Last Name" />
              <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <BiLabel cn="英文名 (First name)" en="First Name" />
              <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <BiLabel cn="手机" en="Cell Phone" />
              <Input value={form.cell} onChange={(e) => set("cell", e.target.value)} className="mt-1" />
            </div>
            <div>
              <BiLabel cn="电子邮件" en="E-mail" />
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <BiLabel cn="节目代码" en="Program Code" />
            <select
              value={form.program}
              onChange={(e) => set("program", e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— 请选择 / Select —</option>
              {PROGRAMS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <BiLabel cn="中文部专题 (週六)" en="Saturday Topic" />
            <select
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— 请选择 / Select —</option>
              {TOPICS.map((t) => <option key={t} value={t[0]}>{t}</option>)}
            </select>
          </div>

          <div>
            <BiLabel cn="床位 (4-11 岁)" en="Bed (ages 4-11)" />
            <select
              value={form.bed}
              onChange={(e) => set("bed", e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              <option value="yes">占床位 ($180) · With Bed</option>
              <option value="no">不占床位 ($110) · Without Bed</option>
            </select>
          </div>

          <div>
            <BiLabel cn="备注" en="Notes" />
            <Textarea value={form.user_notes} onChange={(e) => set("user_notes", e.target.value)} rows={3} className="mt-1" />
          </div>

          <Button type="submit" disabled={submitting} className="w-full rounded-full" size="lg">
            {submitting ? "提交中…" : "提交登记 · Submit"}
          </Button>
        </form>
      </main>
    </div>
  );
}