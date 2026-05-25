
## 改动总览

针对管理后台 `src/routes/admin.tsx`(数据统计 / 成人主日学 / 教会活动) 进行六项调整,并新增一个独立路由用于课程表。

---

### 1. 数据统计板块改造 (Tab: stats)

- Tab 名称由 "数据统计" → **"登记人数统计"**。
- 在现有"新人登记统计"下新增两个统计卡片:
  - **成人主日学** — 数据源 `sunday_school_checkins`
  - **团契 / 小组聚会** — 数据源 `fellowship_checkins`
- 每个卡片显示:
  - **本周参加人数** + 与上周对比的百分比 + 上下箭头
  - **本月参加人数** + 与上月对比的百分比 + 上下箭头
  - **累计签到总数**
  - **本周活跃课程/团契数量** (distinct count)
- 箭头说明活动积极性:绿↑ 表示增长, 红↓ 表示下降, 灰→ 表示持平。

---

### 2. 成人主日学板块布局 (Tab: sunday)

- 当前的"主日学课程设置"按钮 → 移动到 **"已开放课程"** 标题栏的**右上角**(小按钮、ghost 样式)。
- "已开放课程"标题右侧新增 **"课程表"** 按钮。
- 增强"主日学课程设置"对话框:
  - 两个 Tab: **课程管理** | **老师管理**
  - 老师管理:新建 `sunday_school_teachers` 表 (id, name, sort_order, is_active),支持增删改。

---

### 3. 课程表新页面 (新路由 `/sunday-schedule`)

- 新文件 `src/routes/sunday-schedule.tsx` (管理员登录后访问,布局与 retreat-admin 一致)。
- 新表 `sunday_class_schedule`:`id, slot_time, course_name, teacher_name, sort_order, created_at, updated_at`。
- 功能:
  - 行内编辑/新增/删除
  - 老师列下拉选择(来自 `sunday_school_teachers`)
  - 课程列下拉选择(来自 `sunday_school_courses`)
  - **导出 Excel** (xlsx)
  - **打印** (window.print + 打印样式)
- 入口:点击主日学板块的"课程表"按钮 → `window.open('/sunday-schedule', '_blank')`。

---

### 4. 教会活动板块 — 退修会按钮位置 (Tab: events)

- 参考用户截图: **"退修会登记"按钮移动到"教会活动"标题栏最右侧**(与"二维码状态"同一行最右)。
- 保留现有绿色渐变样式,稍微调整尺寸适配标题栏。

---

### 数据库迁移

```sql
-- 1) 老师名单
create table public.sunday_school_teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sunday_school_teachers enable row level security;
create policy "admins manage teachers" on public.sunday_school_teachers
  for all to authenticated
  using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create policy "anyone read active teachers" on public.sunday_school_teachers
  for select to anon, authenticated using (is_active = true);

-- 2) 课程表
create table public.sunday_class_schedule (
  id uuid primary key default gen_random_uuid(),
  slot_time text not null,
  course_name text,
  teacher_name text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sunday_class_schedule enable row level security;
create policy "admins manage class schedule" on public.sunday_class_schedule
  for all to authenticated
  using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
```

---

### 文件改动清单

- **新建**:
  - `supabase/migrations/<timestamp>_sunday_teachers_schedule.sql`
  - `src/routes/sunday-schedule.tsx`
- **修改**:
  - `src/routes/admin.tsx` (Tab 名称、stats 卡片、sunday 板块按钮布局、设置对话框增加老师管理、events 按钮位置)
  - `src/integrations/supabase/types.ts` (迁移后自动更新)

---

### 顺便处理

启动器报告了一个 JSX 闭合标签的运行时错误,实施过程中会一并确认 `<main>` 结构完整。
