import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Role, ServiceArea } from "@/lib/permissions";
import { SERVICE_AREAS } from "@/lib/permissions";

export type CurrentPermissions = {
  loading: boolean;
  userId: string | null;
  role: Role | null;
  serviceArea: ServiceArea | null;
  /** 模块 → 是否启用统计分析。super_admin/admin 视为全部启用。 */
  analytics: Partial<Record<ServiceArea, boolean>>;
};

/** 读取当前登录用户的角色 / 所属事工 / 各模块统计开关。 */
export function useCurrentPermissions(): CurrentPermissions {
  const [state, setState] = useState<CurrentPermissions>({
    loading: true,
    userId: null,
    role: null,
    serviceArea: null,
    analytics: {},
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? null;
      if (!uid) {
        if (!cancelled) setState({ loading: false, userId: null, role: null, serviceArea: null, analytics: {} });
        return;
      }
      const [rolesRes, profileRes, flagsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("user_profiles").select("service_area").eq("user_id", uid).maybeSingle(),
        supabase.from("user_module_analytics").select("service_area, enabled").eq("user_id", uid),
      ]);
      const roles = (rolesRes.data ?? []).map((r) => r.role) as string[];
      const role: Role | null =
        roles.includes("super_admin") ? "super_admin"
        : roles.includes("admin") ? "admin"
        : roles.includes("worker") || roles.includes("user") ? "worker"
        : roles.includes("viewer") ? "viewer"
        : null;
      const serviceArea = ((profileRes.data as { service_area?: string | null } | null)?.service_area ?? null) as ServiceArea | null;
      const analytics: Partial<Record<ServiceArea, boolean>> = {};
      if (role === "super_admin" || role === "admin") {
        for (const a of SERVICE_AREAS) analytics[a] = true;
      } else {
        for (const row of (flagsRes.data ?? []) as { service_area: string; enabled: boolean }[]) {
          if ((SERVICE_AREAS as readonly string[]).includes(row.service_area)) {
            analytics[row.service_area as ServiceArea] = row.enabled;
          }
        }
      }
      if (!cancelled) setState({ loading: false, userId: uid, role, serviceArea, analytics });
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}