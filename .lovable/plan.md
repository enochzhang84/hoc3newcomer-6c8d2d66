## 周报后台编辑界面改造计划

针对 `src/components/admin/ElderWeeklyOverview.tsx` 进行 4 项修改。所有数据按日期持久化到 `localStorage`，不新增数据库表（除非必要）。

---

### 1. 成人主日学课程 / 团契聚会 —— 全自动读取

**当前行为**：成人主日学课程与团契聚会已自动按 `sundayCheckins` / `fellowshipCheckins` 统计签到人数。后台没有编辑入口。

**改动**：
- 成人主日学课程：优先读取 `sunday_class_schedule` 表对应课程的 `student_count`（若 > 0），否则按 `adult_class_checkins` 当主日签到统计。
- 团契聚会：保持当周 (周二—周日) 区间 `fellowship_checkins` 自动计数（已是此逻辑）。
- 后台不出现编辑控件（已是只读展示，确认无需变化）。

需要在 `admin.tsx` 把 `sunday_class_schedule` 现有 query 增加 `student_count` 字段（已存在）并传给 `ElderWeeklyOverview`。

---

### 2. 圣工轮值表 —— 月历模式

**当前**：每个板块用 `<` / `>` 翻页选择主日，数据按日期分别存 `localStorage`。

**改动**：
- 在「圣工轮值表（今日）」标题旁，新增一个日历按钮（`shadcn/ui` 的 `Calendar` + `Popover`）。
- 日历只允许选择周日（其它日期 disabled），选定日期成为当前编辑/展示主日。
- 保留 `<` / `>` 翻页箭头作为快捷方式。
- 数据仍按 ISO 日期 key 存 `localStorage`（无需建表）。

---

### 3. 中文堂主日敬拜程序 —— 固定 7 项

**当前**：整段 textarea 自由文本，含 `#` 标题 / `>` 经训行。

**改动 (后台编辑)**：
- 新建 `WorshipProgram` 数据结构：
  ```ts
  type WorshipProgram = {
    xuanzhao: string;   // 宣召（如 "诗篇 23 篇"）
    changshi: string;   // 唱诗（如 "教会圣诗 100"）
    muqi: string;       // 牧祷（如 "牧师"）
    dujing: string;     // 读经（如 "约翰福音 3:16"）
    jiangdao: string;   // 讲道（如 "信靠主"）
    huiyingshi: string; // 回应诗
    zhufu: string;      // 祝福
  };
  ```
- 后台显示为 7 个 `Input`，每项独立 `onBlur` 保存到 `localStorage`（按主日日期 key）。
- 顶部加「复制上周内容」按钮：把 上一个主日的程序整体复制到当前主日。
- 同样接入第 2 项的月历日期选择器。

**前台 (周报展示)**：
按固定模板拼接显示：
```
1. 宣召 …… {xuanzhao} …… 司会
2. 唱诗 …… {changshi} …… 会众
3. 牧祷 …… {muqi} …… 牧师
4. 读经 …… {dujing} …… 会众
5. 讲道 …… {jiangdao} …… 牧师
6. 回应诗 …… {huiyingshi} …… 会众
7. 祝福 …… {zhufu} …… 长老
```
保持现有 `BulletinLine` 三段式视觉（左 / 虚线 / 右）。

**迁移**：旧 `worship` 字段忽略不读，老数据废弃。新字段保存在 `byDate[iso].worshipProgram`。

---

### 4. 版面自动适配

- 中栏「敬拜程序」容器加 CSS：`overflow: hidden`，最长 `worshipProgram` 字段超过阈值时，整段字号从 17px 缩到 15px / 13px（用 `useLayoutEffect` 检测 `scrollHeight > clientHeight` 循环降字号）。
- 实现一个轻量 `<AutoFit>` 包装组件：尝试 17→16→15→14→13 px，直到不溢出。
- 打印样式不变。

---

### 技术要点

| 项 | 文件 | 操作 |
|---|---|---|
| 1 | `ElderWeeklyOverview.tsx` + `admin.tsx` | 传入 `kidsClasses`-like `classCounts: {course_name, student_count}[]`；课程渲染优先用 student_count |
| 2 | `ElderWeeklyOverview.tsx` | 引入 `Calendar`+`Popover`，限定 weekday=0 可选 |
| 3 | `ElderWeeklyOverview.tsx` | 新增 7 字段编辑 UI + 模板渲染；废弃 `worship` 自由文本 |
| 4 | `ElderWeeklyOverview.tsx` | 新增 `AutoFit` 组件，应用于中栏敬拜程序 |

不需要数据库迁移；不修改其它模块代码。

---

### 需用户确认 1 个点

第 1 项「记录中有总数」是否指 `sunday_class_schedule.student_count`（每课程在班级管理录入的报名人数）？如果是其他含义请告知。如果没有特别指示，我将按此实现。
