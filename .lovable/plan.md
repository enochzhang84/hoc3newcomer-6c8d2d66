
# 正式管理员权限体系实施方案

## 1. 角色模型

将现有的 `app_role` enum 从 `super_admin / admin / user / viewer` 改为：

| 角色 | 说明 |
|------|------|
| `super_admin` | 最高权限，可管理所有用户、权限、数据 |
| `admin` | 普通管理员，可管理业务数据，**不能**修改 / 删除 super_admin |
| `worker` | 同工，只能进入自己 `service_area` 对应模块 |
| `viewer` | 普通查看用户，只能查看公开页面，**不能**进入后台 |

> 把现有的 `user` 角色统一迁移为 `worker`（语义对齐）。

---

## 2. 数据库改动（单次 migration）

### 2.1 修改 enum
- `ALTER TYPE app_role ADD VALUE 'worker'`
- 把 user_roles 表里所有 `role='user'` 更新为 `worker`
- （Postgres 不能直接删除 enum 值，保留 `user` 作为废弃值不影响功能）

### 2.2 `user_profiles` 表新增字段
```sql
ALTER TABLE public.user_profiles
  ADD COLUMN service_area text,        -- 单一主事工（worker 用于路由判定）
  ADD COLUMN display_name text,
  ADD COLUMN is_disabled boolean NOT NULL DEFAULT false;
```
`service_area` 取值约束（应用层校验）：
`newcomer | retreat | kitchen | welcome | media | sunday_school | tv_display | chat`

### 2.3 首位用户自动提升为 super_admin
新建触发器 `handle_first_user`：在 `auth.users` INSERT 后，若 `user_roles` 表为空，则给该用户写入 `super_admin`；否则写入 `viewer`。
（替换现有 `handle_new_user` 的"留空"逻辑）

### 2.4 安全 helper 函数
- `public.is_super_admin(_uid uuid)` — SECURITY DEFINER
- `public.is_admin_or_above(_uid uuid)` — super_admin 或 admin
- `public.get_service_area(_uid uuid) returns text`

### 2.5 RLS / GRANT
- `user_roles`：保持现状，新增「admin 可读但仅 super_admin 可写」策略
- `user_profiles`：admin 可读所有；仅本人或 super_admin 可写 `service_area / is_disabled`

---

## 3. 服务端权限函数（`src/lib/users.functions.ts`）

全部使用 `requireSupabaseAuth` + 角色断言：

| Server Function | 谁能调用 | 行为 |
|-----------------|---------|------|
| `listUsersWithRoles` | admin 及以上 | 返回邮箱、worker_name、display_name、role、service_area、last_sign_in_at、is_disabled |
| `setUserRole` | **仅 super_admin** | 改角色；禁止对其他 super_admin 操作；禁止把自己降级到无 admin |
| `setUserServiceArea` | super_admin | 设置 worker 所属模块 |
| `setUserDisabled` | super_admin | 禁用/启用（写 `is_disabled` 并撤销 session） |
| `deleteUser` | super_admin | 不能删自己，不能删其他 super_admin |
| `updateUserWorkerName` / `updateDisplayName` | super_admin 或本人 | 更新资料 |

**核心规则**：所有 mutate 都先查目标用户是否为 super_admin；若调用者不是 super_admin 则抛错。

---

## 4. 前端路由守卫

新增 `src/lib/permissions.ts`：

```ts
export type Role = 'super_admin' | 'admin' | 'worker' | 'viewer';
export type ServiceArea = 'newcomer' | 'retreat' | ... ;

export function canAccessAdmin(role: Role): boolean
export function canAccessModule(role: Role, area: ServiceArea | null, target: ServiceArea): boolean
```

规则：
- viewer / 未登录 → 不可进 `/admin`，进入 admin 路由时跳 `/`
- worker → 可进 `/admin`，但 Tabs 只显示其 `service_area` 对应模块
- admin / super_admin → 全部 Tabs 可见
- 仅 super_admin 看到「用户管理」Tab

在 `src/routes/admin.tsx` 的 `useEffect` 加载阶段读取当前用户 role + service_area，根据上述规则过滤 Tabs 数组。

---

## 5. 用户管理 UI（`src/components/admin/UserManagementPanel.tsx`）

仅 super_admin 可见的新 Tab。表格列：

| 邮箱 | 同工姓名 | 显示名 | 角色 | 所属事工 | 最后登录 | 状态 | 操作 |

操作：编辑角色（下拉）/ 编辑事工（下拉）/ 编辑同工姓名 / 禁用-启用 / 删除。

约束：
- 行内若 `role === 'super_admin'` 且不是自己 → 操作按钮全部 disable
- 删除 / 降级自己时弹确认 + 服务端再次校验

---

## 6. 技术细节

```
DB:
  - app_role enum: + 'worker'
  - 数据迁移: user → worker
  - user_profiles: + service_area, + display_name, + is_disabled
  - 触发器 handle_first_user (替换 handle_new_user)
  - helpers: is_super_admin, is_admin_or_above, get_service_area

Backend (createServerFn + requireSupabaseAuth):
  - src/lib/users.functions.ts 重构（统一权限断言）
  - 新增 setUserServiceArea / setUserDisabled
  - 所有写操作禁止跨级修改 super_admin

Frontend:
  - src/lib/permissions.ts（角色 + 模块映射）
  - src/routes/admin.tsx：根据 role 过滤 Tabs；非 admin/super_admin/worker 重定向
  - src/components/admin/UserManagementPanel.tsx（仅 super_admin Tab）
  - 旧的"分配权限"UI 收敛到此面板
```

---

## 7. 不在本次范围内

- 旧的 `service_projects: text[]` 字段保留（向后兼容），新逻辑读 `service_area`
- viewer 没有任何后台入口，但保留登录跳转到首页
- 暂不实现「多事工 worker」（一个 worker 只属一个 service_area；如需多个再扩展）

---

## 实施顺序

1. 数据库 migration（enum + 表 + 触发器 + helpers）
2. 重构 `users.functions.ts`
3. 新增 `permissions.ts`
4. 修改 `admin.tsx` 路由守卫与 Tabs 过滤
5. 新增 `UserManagementPanel.tsx`
6. 测试：首位注册 → super_admin；第二位注册 → viewer；super_admin 提升 worker 并指定 service_area；worker 登录只看到自己模块
