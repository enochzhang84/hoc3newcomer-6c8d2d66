import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/retreat-highlights")({
  component: RetreatHighlightsPage,
  head: () => ({
    meta: [
      { title: "🏕 HOC3 联合退修会亮点" },
      { name: "description", content: "2026 基督之家联合退修会亮点介绍" },
    ],
  }),
});

function RetreatHighlightsPage() {
  return (
    <div className="min-h-screen w-full bg-[#FAF3E3] py-8 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 1 — 标题 */}
        <div className="bg-card border border-border/50 rounded-2xl p-6">
          <h2 className="font-serif text-2xl text-center leading-tight">
            2026 基督之家联合退修会
          </h2>
          <p className="text-center text-sm text-muted-foreground mt-1">
            The Home of Christ Church Joint Retreat Conference
          </p>
          <p className="text-center text-sm mt-2">🏕 退修会亮点介绍</p>
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
          <p>
            Sonoma State University
            <br />
            1801 E. Cotati Ave., Rohnert Park, CA 94928
          </p>
          <p className="text-xs text-muted-foreground">
            Tel: 707-664-2527 · www.sonoma.edu/cec
          </p>
          <hr className="my-2 border-border/60" />
          <p className="font-medium">填表说明 · Instructions</p>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            <li>
              请按夫、妻、子女、朋友等顺序填写，填写在同一张报名表的人将尽量被安排在同一栋宿舍。Everyone in this form will likely be assigned to the same apartment unit.
            </li>
            <li>
              请在黑体栏目中填入必需的信息。Please provide required information in the columns with bold headings.
            </li>
          </ul>
          <hr className="my-2 border-border/60" />
          <p className="font-medium">注意事项</p>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            <li>
              报名网址：http://hoc.org（login: hoc1/hoc1, hoc2/hoc2, hoc3/hoc3, hoc4/hoc4, hoc5/hoc5, hoc6/hoc6, hoc7/hoc7）。
            </li>
            <li>
              报名费用：2026/7/15 前，未满 4 岁免费；4–11 岁不占床位 $110，占床位 $180；12 岁以上必需占床位。预估每人 $308。
            </li>
            <li>报名截止：6/30/2026，先到先得，额满即止。</li>
            <li>
              保险规定：未满 18 岁父母未同行者，请填 Medical &amp; Liability Release Form，与报名表、报名费一同缴上。
            </li>
            <li>
              节目简介：今年分中文堂、英文堂，3–11 岁儿童由老师带领，0–2 岁儿童由家长照顾。
            </li>
            <li>
              节目代码：中文(M)、英文(E)、9–11岁(N)、7–8岁(S)、5–6岁(F)、4岁(T)、3岁(R)、0–2岁(B)。
            </li>
            <li>交通安排：我们可以接送 ___ 位；我们有 ___ 位需要被接送。</li>
            <li>
              携带物品：圣经、笔、漱洗用具、日用衣物、常用药品、游泳衣、手电筒、运动器材等。SSU 提供寝具，但不占床位的儿童请自备睡袋。
            </li>
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
      </div>
    </div>
  );
}