import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { lookupRetreatGroupByPhone } from "@/lib/retreat.functions";
import { RetreatGroupEditor, type GroupMember } from "@/components/RetreatGroupEditor";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/retreat-edit")({
  component: EditRegistrationPage,
  head: () => ({
    meta: [
      { title: "修改注册信息 — 退修会" },
      { name: "description", content: "查询并修改退修会注册信息。" },
    ],
  }),
});

type Group = { key: string; members: GroupMember[] };

function EditRegistrationPage() {
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const lookup = useServerFn(lookupRetreatGroupByPhone);

  async function handleSearch() {
    if (!phone.trim()) return toast.error("请输入电话号码");
    setSearching(true);
    try {
      const res = await lookup({ data: { phone: phone.trim() } });
      const gs = res.groups as Group[];
      setGroups(gs);
      if (gs.length === 0) toast.info("未找到匹配的登记记录");
      else if (gs.length === 1) setActiveKey(gs[0].key);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  const activeGroup = groups?.find((g) => g.key === activeKey) ?? null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="border-b border-border/60 sticky top-0 z-20 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <Link to="/retreat" className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="" className="h-8 w-8 object-contain shrink-0" />
            <span className="font-serif text-base sm:text-lg truncate">修改注册信息 / Edit Registration</span>
          </Link>
          <Link to="/retreat">
            <Button variant="outline" size="sm">返回</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6 order-1 lg:order-1">
        <div className="bg-card border border-border/50 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Lookup / Edit My Registration</p>
          <div className="space-y-2">
            <Label>请输入登记单上任意一位人员的电话号码</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例如 510-123-4567"
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching} className="rounded-full px-6">
                {searching ? "查询中…" : "查询"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">输入家庭中任意一位的电话号码，即可看到同一张登记单下所有人员。</p>
          </div>

          {groups && groups.length > 1 && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">共找到 {groups.length} 张登记单，请选择：</p>
              <ul className="space-y-2">
                {groups.map((g) => {
                  const first = g.members[0];
                  const conf = first?.confirmation_no ?? "";
                  const parts = conf.split("-");
                  const formNo = parts.length === 3 ? `${parts[0]}-${parts[1]}` : conf;
                  return (
                    <li
                      key={g.key}
                      className="rounded-xl border border-border/50 bg-muted/20 p-4 flex items-center justify-between gap-3 flex-wrap hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setActiveKey(g.key)}
                    >
                      <div className="text-sm flex-1 min-w-0">
                        <div className="font-medium">登记单 {formNo} · 共 {g.members.length} 位</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {g.members.map((m) => m.chinese_name).join("、")}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full shrink-0">编辑</Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {groups && groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center pt-2">未找到匹配的登记记录</p>
          )}
        </div>
        </div>
        <aside className="order-2 lg:order-2 space-y-5 lg:sticky lg:top-24">
          <div className="hidden lg:block bg-card border border-border/50 rounded-2xl p-6">
            <h2 className="font-serif text-2xl text-center leading-tight">2026 基督之家联合退修会</h2>
            <p className="text-center text-sm text-muted-foreground mt-1">
              The Home of Christ Church Joint Retreat Conference
            </p>
            <p className="text-center text-sm mt-2">报名表 · Registration Form</p>
          </div>
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
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <p className="font-medium text-sm mb-2">中文部专题讲题和讲员</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
              <li>週六：迎接老年时代的来临—一个基督徒的立场（廖俊惠医师）</li>
              <li>週六：婚姻成长 DIY / 陪孩子走一段路（郭颜上琉师母）</li>
              <li>週六：走过悲伤与忧鬱—信仰中的关顾与盼望（林慈敏博士）</li>
              <li>週六：如何在 AI 热潮、高关税、股市高点下，做幸福理财好管家（陈少豪牧师）</li>
            </ol>
          </div>
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

      {activeGroup && (
        <RetreatGroupEditor
          open={!!activeGroup}
          onClose={() => setActiveKey(null)}
          members={activeGroup.members}
          phone={phone}
          onChanged={async (next) => {
            if (next.length === 0) {
              // Group fully deleted — re-run lookup to refresh remaining groups
              try {
                const res = await lookup({ data: { phone: phone.trim() } });
                setGroups(res.groups as Group[]);
              } catch {/* ignore */}
              setActiveKey(null);
            } else {
              setGroups((prev) => {
                if (!prev) return prev;
                return prev.map((g) => g.key === activeKey ? { ...g, members: next } : g);
              });
            }
          }}
        />
      )}
    </div>
  );
}