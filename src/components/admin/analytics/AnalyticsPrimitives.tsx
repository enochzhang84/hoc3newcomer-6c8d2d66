import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 统一统计卡片 —— 与「数据统计 / 概览」长老仪表板完全一致的视觉风格。
 * 米黄页面底色 + 白色卡片 + 圆角 2xl + 柔和阴影 + 顶部色带（可选 tone）。
 * 全站任何统计区域请复用本组件，不要再各自实现。
 */
export type StatTone = "ok" | "warn" | "alert" | "neutral";

function toneBorder(t?: StatTone) {
  switch (t) {
    case "alert":
      return "border-t-4 border-t-red-400";
    case "warn":
      return "border-t-4 border-t-amber-400";
    case "ok":
      return "border-t-4 border-t-emerald-400";
    default:
      return "";
  }
}
function toneText(t?: StatTone) {
  switch (t) {
    case "alert":
      return "text-red-600";
    case "warn":
      return "text-amber-600";
    case "ok":
      return "text-emerald-600";
    default:
      return "text-foreground";
  }
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
  compact,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
  /** 用于侧边栏等紧凑布局，缩小内边距与数字字号 */
  compact?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "text-left bg-card border border-border/60 rounded-2xl flex flex-col w-full shadow-sm transition-all",
        compact ? "p-3" : "p-5",
        toneBorder(tone),
        onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default",
      )}
    >
      {icon && <div className={cn("leading-none", compact ? "text-base" : "text-xl")}>{icon}</div>}
      <div
        className={cn(
          "text-muted-foreground",
          compact ? "text-[11px] mt-1" : "text-sm mt-2",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "font-bold tabular-nums tracking-tight",
          compact ? "text-2xl mt-1" : "text-4xl mt-2",
          toneText(tone),
        )}
      >
        {value ?? "—"}
      </div>
      {hint && (
        <div
          className={cn(
            "text-muted-foreground/80",
            compact ? "text-[10px] mt-1" : "text-xs mt-2",
          )}
        >
          {hint}
        </div>
      )}
    </Tag>
  );
}

/** 统一的卡片网格，默认两列、间距与首页一致。 */
export function StatGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const c =
    cols === 4 ? "grid-cols-2 md:grid-cols-4" :
    cols === 3 ? "grid-cols-2 md:grid-cols-3" :
    "grid-cols-2";
  return <div className={cn("grid gap-3", c, className)}>{children}</div>;
}

export function MiniBars({ items, max }: { items: { key: string; count: number }[]; max?: number }) {
  if (items.length === 0) return <div className="text-xs text-muted-foreground">暂无数据</div>;
  const m = Math.max(max ?? Math.max(...items.map((i) => i.count)), 1);
  return (
    <div className="space-y-1.5 bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
      {items.slice(0, 8).map((it) => (
        <div key={it.key} className="text-xs">
          <div className="flex justify-between gap-2 text-muted-foreground mb-0.5">
            <span className="truncate">{it.key}</span>
            <span className="text-foreground tabular-nums">{it.count}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${(it.count / m) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 统一的小节标题 + 内容容器。Section / StatSection 等价。 */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-foreground/80 mb-2 pl-1">{title}</div>
      {children}
    </div>
  );
}
export const StatSection = Section;

export function groupBy<T>(list: T[], keyFn: (x: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const x of list) {
    const k = keyFn(x) || "未填";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}