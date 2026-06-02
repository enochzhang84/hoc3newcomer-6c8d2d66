import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVICE_AREAS } from "@/lib/permissions";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

/** admin 或 super_admin 才可读用户列表 */
async function assertAdminOrAbove(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"])
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

/** 校验目标用户不是 super_admin（防止 admin 越权 / super_admin 误删自己以外的同级） */
async function assertTargetNotSuperAdmin(targetUserId: string, callerId: string) {
  if (targetUserId === callerId) return; // 允许操作自己
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) throw new Error("Forbidden: 不能修改其他超级管理员");
}

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrAbove(context.userId);

    const { data: usersData, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (usersError) throw new Error(usersError.message);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) throw new Error(rolesError.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, worker_name, service_project, service_area, display_name, is_disabled");
    const profileByUser = new Map<string, {
      worker_name: string | null;
      service_project: string | null;
      service_area: string | null;
      display_name: string | null;
      is_disabled: boolean;
    }>();
    for (const p of profiles ?? []) {
      profileByUser.set(p.user_id, {
        worker_name: p.worker_name ?? null,
        service_project: p.service_project ?? null,
        service_area: (p as { service_area?: string | null }).service_area ?? null,
        display_name: (p as { display_name?: string | null }).display_name ?? null,
        is_disabled: Boolean((p as { is_disabled?: boolean }).is_disabled ?? false),
      });
    }

    const { data: analyticsRows } = await supabaseAdmin
      .from("user_module_analytics")
      .select("user_id, service_area, enabled");
    const analyticsByUser = new Map<string, string[]>();
    for (const a of (analyticsRows ?? []) as { user_id: string; service_area: string; enabled: boolean }[]) {
      if (!a.enabled) continue;
      const arr = analyticsByUser.get(a.user_id) ?? [];
      arr.push(a.service_area);
      analyticsByUser.set(a.user_id, arr);
    }

    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
      worker_name: profileByUser.get(u.id)?.worker_name ?? null,
      service_project: profileByUser.get(u.id)?.service_project ?? null,
      service_area: profileByUser.get(u.id)?.service_area ?? null,
      display_name: profileByUser.get(u.id)?.display_name ?? null,
      is_disabled: profileByUser.get(u.id)?.is_disabled ?? false,
      analytics_areas: analyticsByUser.get(u.id) ?? [],
    }));
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      makeAdmin: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    await assertTargetNotSuperAdmin(data.userId, context.userId);

    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.userId, role: "admin" },
          { onConflict: "user_id,role" },
        );
      if (error) throw new Error(error.message);
    } else {
      if (data.userId === context.userId) {
        throw new Error("不能撤销自己的管理员权限");
      }
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        throw new Error("至少需要保留一位管理员");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Error("不能删除自己");
    }
    await assertTargetNotSuperAdmin(data.userId, context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 接受 worker（新）与 user（旧别名，已迁移）以兼容旧调用
const roleSchema = z.enum(["super_admin", "admin", "worker", "user", "viewer"]);
const serviceAreaSchema = z.enum(SERVICE_AREAS).nullable();

export const createUserWithRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().max(200),
      password: z.string().min(6).max(200),
      role: roleSchema,
      workerName: z.string().max(100).optional(),
      serviceArea: serviceAreaSchema.optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("创建用户失败");
    // handle_new_user 触发器可能已写入默认角色，覆盖为指定角色
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const finalRole = data.role === "user" ? "worker" : data.role;
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: finalRole });
    if (rErr) throw new Error(rErr.message);
    const profilePatch: {
      user_id: string;
      worker_name?: string;
      service_area?: string | null;
    } = { user_id: newId };
    if (data.workerName && data.workerName.trim()) {
      profilePatch.worker_name = data.workerName.trim();
    }
    if (data.serviceArea !== undefined) {
      profilePatch.service_area = data.serviceArea;
    }
    if (Object.keys(profilePatch).length > 1) {
      await supabaseAdmin
        .from("user_profiles")
        .upsert(profilePatch, { onConflict: "user_id" });
    }
    return { ok: true, userId: newId };
  });

export const updateUserWorkerName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      workerName: z.string().max(100).nullable(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    await assertTargetNotSuperAdmin(data.userId, context.userId);
    const name = data.workerName?.trim() || null;
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: data.userId, worker_name: name }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserServiceArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      serviceArea: serviceAreaSchema,
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    await assertTargetNotSuperAdmin(data.userId, context.userId);
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { user_id: data.userId, service_area: data.serviceArea },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      disabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Error("不能禁用自己");
    }
    await assertTargetNotSuperAdmin(data.userId, context.userId);
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { user_id: data.userId, is_disabled: data.disabled },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    // 禁用时撤销 session，使其立即下线
    if (data.disabled) {
      await supabaseAdmin.auth.admin.signOut(data.userId).catch(() => {});
    }
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: roleSchema.nullable(), // null = revoke approval (pending)
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    await assertTargetNotSuperAdmin(data.userId, context.userId);

    const finalRole = data.role === "user" ? "worker" : data.role;

    // Prevent self-demotion that would lock out the last admin
    if (data.userId === context.userId && finalRole !== "super_admin" && finalRole !== "admin") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .in("role", ["super_admin", "admin"]);
      if ((count ?? 0) <= 1) {
        throw new Error("至少需要保留一位管理员");
      }
    }

    // Replace all roles for this user with the single chosen role
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);

    if (finalRole) {
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: finalRole });
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      password: z.string().min(6).max(200),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    await assertTargetNotSuperAdmin(data.userId, context.userId);
    const { data: got, error: getErr } =
      await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr || !got?.user) throw new Error("用户不存在");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { password: data.password },
    );
    if (error) throw new Error(`Supabase Auth 更新失败: ${error.message}`);
    return { ok: true };
  });