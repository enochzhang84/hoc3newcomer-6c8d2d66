/** 工具函数：主日/圣餐主日/人员去重统计 */

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** 该日期所在月份的第一个星期日 */
export function firstSundayOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  while (x.getDay() !== 0) x.setDate(x.getDate() + 1);
  return x;
}

/** 圣餐主日：每月第一个星期日 */
export function isCommunionSunday(d: Date | string): boolean {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  if (date.getDay() !== 0) return false;
  const first = firstSundayOfMonth(date);
  return (
    first.getFullYear() === date.getFullYear() &&
    first.getMonth() === date.getMonth() &&
    first.getDate() === date.getDate()
  );
}

/** 把多人字符串（顿号 / 逗号 / 换行 / 空格 / 斜杠 分隔）拆成名字数组 */
export function splitPeople(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[、,，/／\n\r;；\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 多组人员合并后按名字去重计数 */
export function dedupCount(...groups: (string | null | undefined)[]): number {
  const set = new Set<string>();
  for (const g of groups) for (const n of splitPeople(g)) set.add(n);
  return set.size;
}