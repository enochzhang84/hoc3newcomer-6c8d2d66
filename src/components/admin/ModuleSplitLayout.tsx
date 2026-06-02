import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { canAccessModuleAnalytics, type ServiceArea, SERVICE_AREA_LABELS } from "@/lib/permissions";
import { useCurrentPermissions } from "@/hooks/useCurrentPermissions";

type Props = {
  area: ServiceArea;
  analytics: ReactNode;
  children: ReactNode;
  /** 强制隐藏左侧统计区。默认根据权限自动决定。 */
  forceHideAnalytics?: boolean;
  /** 左侧标题，默认 "<模块名> 统计分析" */
  analyticsTitle?: string;
};

/**
 * 模块内部「左统计 / 右功能」分区布局。
 * - 左侧统计区只在用户拥有该模块的「统计分析权限」时显示
 * - 右侧始终显示模块功能
 * 移动端竖排：统计在上、功能在下
 */
export function ModuleSplitLayout({ area, analytics, children, forceHideAnalytics, analyticsTitle }: Props) {
  const perms = useCurrentPermissions();
  const showAnalytics = !forceHideAnalytics && !perms.loading &&
    canAccessModuleAnalytics(perms.role, perms.serviceArea, area, perms.analytics);

  if (!showAnalytics) {
    return <div className="w-full min-w-0">{children}</div>;
  }

  return (
    <div className={cn("grid gap-4 min-w-0", "grid-cols-1 lg:grid-cols-[minmax(260px,360px)_1fr]")}>
      <aside className="min-w-0 space-y-3">
        <div className="sticky top-2">
          <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground/90 mb-3 flex items-center gap-2">
              <span aria-hidden>📊</span>
              {analyticsTitle ?? `${SERVICE_AREA_LABELS[area]} · 统计分析`}
            </h3>
            <div className="space-y-3">{analytics}</div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}