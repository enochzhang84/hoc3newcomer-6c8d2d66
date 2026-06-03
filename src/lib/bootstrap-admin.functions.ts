import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkSuperAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1);
  if (error) throw new Error(error.message);
  return { hasSuperAdmin: (data?.length ?? 0) > 0 };
});

export const initializeCurrentUserAsSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1);
    if (existingError) throw new Error(existingError.message);
    if ((existing?.length ?? 0) > 0) throw new Error("系统已存在超级管理员");

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: context.userId }, { onConflict: "user_id" });
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, role: "super_admin" },
        { onConflict: "user_id,role" },
      );
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });