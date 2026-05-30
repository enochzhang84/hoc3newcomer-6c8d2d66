import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  exportBackup,
  importBackup,
  hasSuperAdmin,
  initSuperAdmin,
  RESTORE_GROUPS,
} from "@/lib/backup.functions";

const GROUP_LABELS: Record<string, string> = {
  admins: "管理员和权限",
  newcomers: "新人登记",
  retreat: "退修会",
  welcome: "迎宾/签到",
  meals: "饭食统计",
  home: "首页二维码/系统设置",
  chat: "聊天/留言",
};

function fileTimestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;
}

export function BackupRestorePanel() {
  const doExport = useServerFn(exportBackup);
  const doImport = useServerFn(importBackup);
  const doInit = useServerFn(initSuperAdmin);
  const doHasSuper = useServerFn(hasSuperAdmin);

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(Object.keys(RESTORE_GROUPS)));
  const [results, setResults] = useState<any | null>(null);
  const [needsInit, setNeedsInit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await doHasSuper();
        setNeedsInit(!r.hasSuperAdmin);
      } catch {
        // ignore
      }
    })();
  }, [doHasSuper]);

  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  const onBackup = async () => {
    setBusy(true);
    try {
      const data: any = await doExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hoc3-backup-${fileTimestamp()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("备份已下载");
    } catch (e: any) {
      toast.error(`备份失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onRestore = async (file: File, groups: string[]) => {
    const text = await file.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      toast.error("文件不是合法的 JSON");
      return;
    }
    if (!payload?.tables || typeof payload.tables !== "object") {
      toast.error("备份文件格式不正确：缺少 tables 字段");
      return;
    }
    const ok = window.confirm(
      "恢复数据会覆盖当前数据库中的部分内容，请确认已经备份当前数据。是否继续？",
    );
    if (!ok) return;
    setBusy(true);
    setResults(null);
    try {
      const res: any = await doImport({ data: { payload, groups } });
      setResults(res);
      toast.success("恢复完成，请查看下方结果");
    } catch (e: any) {
      toast.error(`恢复失败：${e?.message || e}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await onRestore(f, [...selected]);
  };

  const onInit = async () => {
    if (!window.confirm("确认将当前账号初始化为超级管理员？此操作只能执行一次。")) return;
    setBusy(true);
    try {
      await doInit();
      toast.success("已初始化为超级管理员，请刷新页面");
      setNeedsInit(false);
    } catch (e: any) {
      toast.error(`初始化失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        此功能用于更换 Supabase、重新部署、迁移服务器时恢复系统数据。恢复前请务必先备份当前数据库。
      </div>

      {needsInit && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="mb-2">检测到系统暂无超级管理员。</p>
          <Button variant="destructive" disabled={busy} onClick={onInit}>
            初始化为超级管理员
          </Button>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="font-medium">一键备份</h3>
        <p className="text-xs text-muted-foreground">
          导出全部核心表为 JSON 文件，可下载保存到本地。
        </p>
        <Button onClick={onBackup} disabled={busy}>
          {busy ? "处理中..." : "📦 一键备份"}
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">一键恢复</h3>
        <p className="text-xs text-muted-foreground">
          选择要恢复的模块，然后上传 JSON 备份文件。未选中的模块不会被覆盖。
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(GROUP_LABELS).map(([k, label]) => (
            <label
              key={k}
              className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-muted/50"
            >
              <Checkbox checked={selected.has(k)} onCheckedChange={() => toggle(k)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSelected(new Set(Object.keys(RESTORE_GROUPS)))}
            disabled={busy}
          >
            全选
          </Button>
          <Button variant="outline" onClick={() => setSelected(new Set())} disabled={busy}>
            全部取消
          </Button>
          <Button onClick={onPickFile} disabled={busy || selected.size === 0}>
            {busy ? "恢复中..." : "📥 选择文件并恢复"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
          className="hidden"
        />
      </section>

      {results && (
        <section className="space-y-2">
          <h3 className="font-medium">恢复结果</h3>
          {results.missing?.length > 0 && (
            <p className="text-sm text-amber-700">
              缺少表：{results.missing.join(", ")}
            </p>
          )}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">表</th>
                  <th className="p-2 text-right">成功</th>
                  <th className="p-2 text-right">失败</th>
                  <th className="p-2 text-left">说明</th>
                </tr>
              </thead>
              <tbody>
                {(results.results || []).map((r: any) => (
                  <tr key={r.table} className="border-t">
                    <td className="p-2 font-mono text-xs">{r.table}</td>
                    <td className="p-2 text-right">{r.inserted}</td>
                    <td className="p-2 text-right">{r.failed}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {r.error ? `❌ ${r.error}` : (r.warnings || []).join("；") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}