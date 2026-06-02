
# 模块内统计分析权限 + 左右分区布局

## 1. 目标与边界

- **不扩大权限**：worker 仍然只能进入自己 `service_area` 对应的模块。
- **不做全局统计中心**：所有统计严格限定在「本模块」内。
- **每个模块内部**：左边=本模块统计分析，右边=本模块正常功能。
- **统计区显示条件**：用户拥有该模块功能权限 **且** 拥有该模块统计分析权限。
- super_admin / admin 默认拥有全部统计权限。

## 2. 数据库改动（一次 migration）

### 2.1 新增表 `user_module_analytics`
存储 worker 对应模块的「统计分析」开关。super_admin / admin 不需要写入，函数判断里直接放行。

```sql
CREATE TABLE public.user_module_analytics (
  id uuid PK,
  user_id uuid NOT NULL,
  service_area text NOT NULL,  -- newcomer/kitchen/sunday_school/...
  enabled boolean DEFAULT true,
  created_at timestamptz, updated_at timestamptz,
  UNIQUE(user_id, service_area)
);
```
GRANT + RLS：authenticated 可读自己行；super_admin/admin 可读写全部。

### 2.2 安全函数
```sql
public.can_view_analytics(_uid uuid, _area text) returns boolean
-- super_admin/admin → true
-- worker → user_profiles.service_area = _area 且 user_module_analytics(enabled=true)
```

### 2.3 数据相关 RLS 收紧（核心）
目前所有业务表的 SELECT 都是 `has_role(...,'admin')`，意味着 worker 即便登录后端也读不到任何业务数据。需要按模块放开「同一 service_area 的 worker」读权限：

| 模块 | 业务表 | 统计来源表 |
|------|--------|-----------|
| kitchen | meal_plans, meal_types, event_meal_notes | meal_plans, attendance_records |
| sunday_school | sunday_school_courses/teachers/checkins, sunday_class_schedule, kids_class_enrollment_snapshots | 同左 |
| newcomer | registrations, events | registrations |
| retreat | retreat_registrations | 同 |
| welcome | hospitality_ministry_entries, duty_*, fellowships | 同 |
| media (av) | av_notes, av_broadcasts, display_* | 同 |
| tv_display | display_screens/playlists/posters | 同 |

为每张相关表新增一条策略：
```
USING ( get_service_area(auth.uid()) = '<area>' )
```
统计数据走相同的表 + `can_view_analytics` 在 serverFn 里再校验一次。

## 3. 前端权限层（src/lib/permissions.ts 扩展）

新增：
```ts
export function canAccessModuleAnalytics(
  role, area, target, analyticsMap: Record<ServiceArea, boolean>
): boolean
```
规则：admin/super_admin 永远 true；worker 必须 `area===target && analyticsMap[target]===true`。

新增 hook `useCurrentPermissions()`：一次性返回 `{ role, serviceArea, analytics: Record<ServiceArea, boolean> }`，admin 页 + 各模块页共用。

## 4. 用户管理 UI（admin.tsx 内 UserManagementPanel）

每行用户在「角色 / 所属事工」之后加一组复选框：

```
可查看统计分析：
☐ 新人登记  ☐ 厨房  ☐ 主日学  ☐ 退修会
☐ 迎宾  ☐ 影音  ☐ TV 屏幕  ☐ 同工聊天
```

- 只对 role=worker 用户显示，其他角色显示「全部统计（默认）」。
- 勾选/取消立即 upsert/delete `user_module_analytics`。
- 仅 super_admin 可改。

新增 serverFn：
- `listUserAnalyticsAreas(userId)` → string[]
- `setUserAnalyticsArea(userId, area, enabled)`（super_admin 限定）

## 5. 模块页面布局（左统计 / 右功能）

统一 layout 组件 `ModuleSplitLayout`：

```
<ResizablePanelGroup direction="horizontal">
  {showAnalytics && (
    <ResizablePanel defaultSize={32} minSize={22}>
      <AnalyticsPane area={area} />
    </ResizablePanel>
  )}
  <ResizableHandle withHandle />
  <ResizablePanel>{children /* 原功能区 */}</ResizablePanel>
</ResizablePanelGroup>
```

`showAnalytics` 由 `canAccessModuleAnalytics()` 决定，false 时整个左栏 + 把手不渲染。

每个模块一个统计组件：
- `KitchenAnalytics` — 就餐人数/趋势/儿童·老师·大堂/每周变化/导出
- `SundaySchoolAnalytics` — 学生/班级/老师/出勤率/年度趋势
- `NewcomerAnalytics` — 来源/城市/年龄/信仰/跟进/月度年度趋势
- `RetreatAnalytics`, `HospitalityAnalytics`, `MediaAnalytics`, `TVDisplayAnalytics`

每个组件内部都用 `createServerFn` 调用「该模块专属」统计接口；接口内：
```ts
.middleware([requireSupabaseAuth])
.handler(({context, data}) => {
  assertCanViewAnalytics(context, 'kitchen')  // 服务端二次校验
  ...
})
```

## 6. admin.tsx Tabs 过滤

继续按 `service_area` 过滤 Tabs（worker 只看到一个 Tab）。在每个 Tab 内容外套 `ModuleSplitLayout`。super_admin 仍看到「用户管理」「全局统计（如果有）」。

> 现有「全局数据统计/data-preview」页面仅 super_admin/admin 可访问 —— 不改入口，但确保 worker 直接访问 URL 时被 redirect。

## 7. 现有路由保护

- `/data-preview`：增加 role 检查，非 admin/super_admin → `/`。
- `/admin`：维持 `_authenticated` 守卫；内部按 service_area 过滤 Tab。

## 8. 实施顺序

1. migration：`user_module_analytics` + `can_view_analytics` + 模块业务表 worker SELECT 策略
2. serverFn：`getCurrentPermissions`、`listUserAnalyticsAreas`、`setUserAnalyticsArea` + 各模块统计 fn
3. `permissions.ts` 扩展 + `useCurrentPermissions` hook
4. `ModuleSplitLayout` + 7 个 `<XxxAnalytics>` 组件（先骨架，再补图表）
5. `admin.tsx`：Tabs 外套 layout；用户管理面板加复选框
6. `/data-preview` 加 role 守卫
7. 手测：worker(kitchen) 只看到厨房 Tab + 左侧统计；取消统计勾选后左栏消失；直接访问 `/data-preview` 被踢回首页

## 9. 不在范围

- 不新增「全局数据中心」入口
- 不动现有 `service_projects[]` 字段（保留向后兼容）
- 「同工聊天」「TV 屏幕管理」的统计先放骨架（人数/在线时长占位），后续按需求扩展
