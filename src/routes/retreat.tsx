import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  lookupRetreatByPhone,
  updateRetreatByPhone,
  deleteRetreatByPhone,
} from "@/lib/retreat.functions";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/retreat")({
  component: RetreatPage,
  head: () => ({
    meta: [
      { title: "退修会登记 — 基督之家第三家" },
      { name: "description", content: "2026 基督之家联合退修会扫码登记。" },
    ],
  }),
});

type Row = {
  id: string;
  confirmation_no: string | null;
  chinese_name: string;
  last_name: string | null;
  first_name: string | null;
  gender: string | null;
  cell: string | null;
  email: string | null;
  program: string | null;
  topic: string | null;
  bed: string | null;
  can_pickup: number | null;
  need_pickup: number | null;
  user_notes: string | null;
  church: string | null;
  paid?: boolean | null;
};

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
const TOPICS: { v: string; label: string }[] = [
  { v: "1", label: "1 - 迎接老年时代的来临 - 一个基督徒的立场 - 廖俊惠医师主讲" },
  { v: "2", label: "2 - 婚姻成长 DIY / 陪孩子走一段路 - 郭磊土疏师母" },
  { v: "3", label: "3 - 走过悲伤与忧郁：信仰中的关键与盼望 - 林慈敏博士主讲" },
  { v: "4", label: "4 - 如何在 AI 热潮、高关税、股市高点下做个福音理财好管家 - 陈少豪牧师主讲" },
];

function RetreatPage() {
  const PUBLISHED_ORIGIN = "https://hoc3newcomer.lovable.app";
  const url = `${PUBLISHED_ORIGIN}/retreat-register`;

  const [lookupOpen, setLookupOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const lookup = useServerFn(lookupRetreatByPhone);
  const update = useServerFn(updateRetreatByPhone);
  const remove = useServerFn(deleteRetreatByPhone);

  async function handleSearch() {
    if (!phone.trim()) return toast.error("请输入电话号码");
    setSearching(true);
    try {
      const res = await lookup({ data: { phone: phone.trim() } });
      setRows(res.rows as Row[]);
      if (res.rows.length === 0) toast.info("未找到匹配的登记记录");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function resetLookup() {
    setLookupOpen(false);
    setPhone("");
    setRows(null);
    setEditing(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await update({
        data: {
          id: editing.id,
          phone: phone.trim(),
          patch: {
            chinese_name: editing.chinese_name,
            last_name: editing.last_name,
            first_name: editing.first_name,
            gender: editing.gender,
            cell: editing.cell,
            email: editing.email,
            program: editing.program,
            topic: editing.topic,
            bed: editing.bed,
            need_pickup: editing.need_pickup,
            user_notes: editing.user_notes,
            church: editing.church,
            can_pickup: editing.can_pickup,
          },
        },
      });
      toast.success("已保存");
      setEditing(null);
      // refresh list
      const res = await lookup({ data: { phone: phone.trim() } });
      setRows(res.rows as Row[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: Row) {
    if (!confirm(`确定删除 ${r.chinese_name} 的登记?`)) return;
    try {
      await remove({ data: { id: r.id, phone: phone.trim() } });
      toast.success("已删除");
      setEditing(null);
      const res = await lookup({ data: { phone: phone.trim() } });
      setRows(res.rows as Row[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="基督之家第三家" className="h-10 w-10 object-contain" />
            <span className="font-serif text-xl tracking-wide text-foreground">基督之家第三家</span>
          </Link>
          <Link to="/retreat-admin">
            <Button variant="outline" size="sm">查看名单</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 items-center max-w-5xl mx-auto">
          <div className="font-kaiti text-foreground">
            <h1 className="font-serif text-3xl md:text-4xl mb-2 leading-tight">
              欢迎你参加退修会
            </h1>
            <p className="text-muted-foreground mb-6 text-sm">
              The Home of Christ Church Joint Retreat Conference
            </p>
            <div className="text-base leading-relaxed mb-6">
              <p>2026 基督之家联合退修会</p>
              <p>主题：跨越—萬國萬代</p>
              <p>讲员：柏有成博士</p>
              <p className="mt-2 text-sm text-muted-foreground">
                7/24 Fri 1:00PM — 7/26 Sun 1:00PM<br />
                Sonoma State University
              </p>
            </div>
            <blockquote className="italic text-foreground/85 leading-relaxed">
              「神能将各样的恩惠多多地加给你们，使你们凡事常常充足，能多行各样善事。」
              <div className="mt-1 text-sm text-muted-foreground not-italic">— 哥林多后书 9:8</div>
            </blockquote>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-card p-8 rounded-2xl shadow-xl border border-border/40">
              <QRCodeSVG value={url} size={240} level="H" />
              <div className="text-center mt-4">
                <p className="text-sm font-medium">扫码登记</p>
                <p className="text-xs text-muted-foreground mt-1">退修会登记</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Link to="/retreat-register">
                <Button size="lg" className="rounded-full px-8">立即登记</Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8"
                onClick={() => setLookupOpen(true)}
              >
                查看信息
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* 查看 / 编辑 / 删除 — 通过电话号码 */}
      <Dialog open={lookupOpen} onOpenChange={(o) => { if (!o) resetLookup(); else setLookupOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>查看 / 修改我的登记</DialogTitle>
          </DialogHeader>

          {!editing && (
            <div className="space-y-4">
              <div>
                <Label>请输入登记时填写的电话号码</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例如 510-123-4567"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  />
                  <Button onClick={handleSearch} disabled={searching}>
                    {searching ? "查询中…" : "查询"}
                  </Button>
                </div>
              </div>

              {rows && rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">共找到 {rows.length} 条记录,点击进行编辑</p>
                  <ul className="divide-y divide-border/40 border border-border/40 rounded-lg overflow-hidden">
                    {rows.map((r) => (
                      <li key={r.id} className="p-3 hover:bg-muted/40 cursor-pointer flex items-center justify-between gap-3" onClick={() => setEditing(r)}>
                        <div className="text-sm">
                          <div className="font-medium">{r.chinese_name} {r.gender ? `(${r.gender})` : ""}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.confirmation_no ?? ""} · {r.cell ?? ""} · {r.program ?? ""}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">编辑</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rows && rows.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">未找到匹配的登记记录</p>
              )}
            </div>
          )}

          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>基督之家</Label>
                  <select value={editing.church ?? ""} onChange={(e) => setEditing({ ...editing, church: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">—</option>
                    {CHURCHES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <Label>性别</Label>
                  <select value={editing.gender ?? ""} onChange={(e) => setEditing({ ...editing, gender: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">—</option><option value="M">M</option><option value="F">F</option>
                  </select>
                </div>
                <div>
                  <Label>中文姓名</Label>
                  <Input className="mt-1" value={editing.chinese_name} onChange={(e) => setEditing({ ...editing, chinese_name: e.target.value })} />
                </div>
                <div>
                  <Label>已付费</Label>
                  <div className="mt-1 h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                    {editing.paid ? "✓ 已付" : "未付"}
                  </div>
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input className="mt-1" value={editing.last_name ?? ""} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
                </div>
                <div>
                  <Label>First Name</Label>
                  <Input className="mt-1" value={editing.first_name ?? ""} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
                </div>
                <div>
                  <Label>Cell</Label>
                  <Input className="mt-1" value={editing.cell ?? ""} onChange={(e) => setEditing({ ...editing, cell: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                </div>
                <div>
                  <Label>Program</Label>
                  <select value={editing.program ?? ""} onChange={(e) => setEditing({ ...editing, program: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">—</option>{PROGRAMS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Topic</Label>
                  <select value={editing.topic ?? ""} onChange={(e) => setEditing({ ...editing, topic: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">—</option>{TOPICS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Bed</Label>
                  <select value={editing.bed ?? ""} onChange={(e) => setEditing({ ...editing, bed: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">—</option><option value="yes">占床位</option><option value="no">不占床位</option>
                  </select>
                </div>
                <div>
                  <Label>可接送 / 需接送</Label>
                  <div className="mt-1 flex gap-2">
                    <Input type="number" min={0} placeholder="可接" value={editing.can_pickup ?? ""} onChange={(e) => setEditing({ ...editing, can_pickup: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                    <Input type="number" min={0} placeholder="需接" value={editing.need_pickup ?? ""} onChange={(e) => setEditing({ ...editing, need_pickup: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                  </div>
                </div>
              </div>
              <div>
                <Label>备注</Label>
                <Textarea rows={2} className="mt-1" value={editing.user_notes ?? ""} onChange={(e) => setEditing({ ...editing, user_notes: e.target.value })} />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="destructive" onClick={() => handleDelete(editing)}>删除</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}