import type { ReactNode } from "react";

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-serif text-foreground leading-tight mt-0.5">{value ?? "—"}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function MiniBars({ items, max }: { items: { key: string; count: number }[]; max?: number }) {
  if (items.length === 0) return <div className="text-xs text-muted-foreground">暂无数据</div>;
  const m = Math.max(max ?? Math.max(...items.map((i) => i.count)), 1);
  return (
    <div className="space-y-1.5">
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

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-foreground/80 mb-1.5">{title}</div>
      {children}
    </div>
  );
}

export function groupBy<T>(list: T[], keyFn: (x: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const x of list) {
    const k = keyFn(x) || "未填";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}