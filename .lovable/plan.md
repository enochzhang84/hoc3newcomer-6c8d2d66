# 圣工轮值表（今日）自动化方案

把当前手工填写的 12 项轮值，改造为「按主日日期自动从各事工模块读取」。所有数据按日期保存，周报按当前主日自动读取，未录入显示「待定」。

## 后台编辑器整体调整

「圣工轮值表（今日）」后台不再是单一文本/字段编辑器，而是一个**只读汇总视图**，展示当前主日各项岗位的自动读取结果，并在每行旁提供「去录入」按钮直达对应事工的月历编辑界面。仅圣餐主日显示「圣餐服事」行。

字段重命名：`餐前投影` → `录音投影`。

## 数据源映射

| 周报项目 | 数据来源 | 取值规则 |
|---|---|---|
| 讲员 / 司会 / 领诗 / 司琴 | 新表 `worship_service_roles` | 按主日日期录入 |
| 招待 | 现有 `hospitality_ministry_entries`（接待事工 → 轮值表） | 该日 `迎宾接待 / 后门` |
| 新人接待 | 同上 | 该日 `新人接待 / 前门` |
| 圣餐服事 1/2 | 新表 `communion_service` | 仅每月第 1 个主日显示 |
| 录音投影 | 现有 `duty_schedules`（影音投影 → 主日 PPT 岗位） | 该日 PPT 人员 |
| 视频播放 | 现有 `duty_schedules`（影音投影 → 直播 / 直播1） | 两人同时显示 |
| 厨房服事 | 新表 `kitchen_duty` | 按主日日期录入 |
| 堂务 | 新表 `custodial_duty` | 按主日日期录入 |
| 插花 | 新表 `flower_duty` | 按主日日期录入 |

未录入统一显示「待定」。

## 主页「服侍统计人数」

汇总当天「圣工轮值表（今日）」+「儿童事工（教师）」所有人员，按人名去重后计数，显示在主页。

## 圣餐主日判定

工具函数 `isCommunionSunday(date)`：当 `date` 为该月份的第 1 个星期日时返回 `true`。

## 新增数据库表（共 5 个，统一结构）

每张表都按主日日期唯一保存，结构：

```text
worship_service_roles
  service_date date PK, preacher text, host text, song_leader text, pianist text

communion_service
  service_date date PK, worker_1 text, worker_2 text

kitchen_duty
  service_date date PK, workers text   -- 多人用顿号/换行分隔

custodial_duty
  service_date date PK, workers text

flower_duty
  service_date date PK, workers text
```

每张表：
- `GRANT` 给 `authenticated` / `service_role`；`anon` 只读（周报公开页需要）
- RLS：`anon/authenticated` SELECT 允许；admin/super_admin 全权管理
- 加 `created_at` / `updated_at` + `set_updated_at` trigger

## 新增后台编辑器

5 个轮值录入面板，统一「月历模式」交互（参考现有 `HospitalityCalendar.tsx`）：

1. `WorshipRolesCalendar` — 讲员/司会/领诗/司琴
2. `CommunionCalendar` — 仅每月第一主日可编辑两位人员
3. `KitchenDutyCalendar` — 单一「人员」文本域
4. `CustodialDutyCalendar` — 同上
5. `FlowerDutyCalendar` — 同上

挂入管理后台 ElderWeeklyOverview 所在页面（与现有「接待事工」「影音投影」入口并列）。

## `ElderWeeklyOverview` 改造

- 新增 `useEffect` 拉取当前 `dutySunday` 对应 5 张新表 + hospitality + duty_schedules。
- 移除现有手写 `editDuty.duty` 文本字段；`DutyEditor` 改为只读汇总 + 跳转按钮。
- `WeeklyDutyView`（周报视图）按上方映射拼装，缺值显示「待定」；非圣餐主日跳过「圣餐服事」行。
- 主页服侍统计人数：新增 helper 统计去重人数（影响首页 `HomePage` 已有的"服侍人数"位置；如果当前没有这块 UI，留 TODO 不动主页）。

## 技术细节

- 新表的 `service_date` 使用 `date` 类型，主键即日期，方便 upsert。
- 多人字段统一用换行分隔，前端 split 显示。
- 圣餐主日 helper 放在 `src/lib/sunday-utils.ts`。
- 数据读取在 `ElderWeeklyOverview` 中合并到现有 `byDate` state，避免破坏现有 SWR 行为。

## 范围说明

本次提交只覆盖：
1. 数据库迁移（5 张表 + 权限 + RLS + trigger）
2. 5 个新的月历编辑器组件 + 后台入口
3. `ElderWeeklyOverview` 中「圣工轮值表（今日）」与周报视图改造
4. `isCommunionSunday` + 服侍人数去重 helper

主页「服侍统计人数」UI 如果现有首页没有该区块，将仅导出 helper 不强行加 UI；若有则替换其数据源。请确认是否要本轮一并接入主页 UI。
