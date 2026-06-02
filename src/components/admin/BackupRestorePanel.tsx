import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  exportBackup,
  importBackup,
  hasSuperAdmin,
  initSuperAdmin,
  RESTORE_GROUPS,
  GROUP_LABELS,
  previewBackup,
  previewRestore,
  listBackupLogs,
  exportSchemaDoc,
  TABLE_NOTES,
} from "@/lib/backup.functions";

function fileTimestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString("zh-CN");
  } catch {
    return s;
  }
}

export function BackupRestorePanel() {
  const doExport = useServerFn(exportBackup);
  const doImport = useServerFn(importBackup);
  const doInit = useServerFn(initSuperAdmin);
  const doHasSuper = useServerFn(hasSuperAdmin);
  const doPreviewBackup = useServerFn(previewBackup);
  const doPreviewRestore = useServerFn(previewRestore);
  const doListLogs = useServerFn(listBackupLogs);
  const doSchemaDoc = useServerFn(exportSchemaDoc);

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(Object.keys(RESTORE_GROUPS)));
  const [results, setResults] = useState<any | null>(null);
  const [lastBackupSummary, setLastBackupSummary] = useState<Record<string, number> | null>(null);
  const [needsInit, setNeedsInit] = useState(false);
  const [backupPreview, setBackupPreview] = useState<any | null>(null);
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [logs, setLogs] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await doHasSuper();
        setNeedsInit(!r.hasSuperAdmin);
      } catch {
        // ignore
      }
      try {
        const r: any = await doListLogs();
        setLogs(r.logs || []);
      } catch {
        // ignore
      }
    })();
  }, [doHasSuper, doListLogs]);

  const refreshLogs = async () => {
    try {
      const r: any = await doListLogs();
      setLogs(r.logs || []);
    } catch {
      // ignore
    }
  };

  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  const onPreviewBackup = async () => {
    setBusy(true);
    try {
      const p: any = await doPreviewBackup();
      setBackupPreview(p);
    } catch (e: any) {
      toast.error(`预览失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
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
      setLastBackupSummary(data?.summary || null);
      toast.success("备份已下载");
      setBackupPreview(null);
      await refreshLogs();
    } catch (e: any) {
      toast.error(`备份失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      toast.error("文件不是合法的 JSON");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!payload?.tables || typeof payload.tables !== "object") {
      toast.error("备份文件格式不正确：缺少 tables 字段");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const preview: any = await doPreviewRestore({ data: { payload } });
      setRestorePreview(preview);
      setPendingPayload(payload);
    } catch (err: any) {
      toast.error(`预检失败：${err?.message || err}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onConfirmRestore = async () => {
    if (!pendingPayload) return;
    const ok = window.confirm(
      `即将以「${restoreMode === "merge" ? "合并模式（只新增）" : "覆盖模式（先清空再恢复）"}」恢复${selected.size}个模块。是否继续？`,
    );
    if (!ok) return;
    setBusy(true);
    setResults(null);
    try {
      const res: any = await doImport({
        data: { payload: pendingPayload, groups: [...selected], mode: restoreMode },
      });
      setResults(res);
      toast.success("恢复完成，请查看下方结果");
      setRestorePreview(null);
      setPendingPayload(null);
    } catch (e: any) {
      toast.error(`恢复失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onCancelRestore = () => {
    setRestorePreview(null);
    setPendingPayload(null);
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

  const onExportSchema = async () => {
    setBusy(true);
    try {
      const r: any = await doSchemaDoc();
      const rows = (r.rows || []).map((row: any) => ({
        模块: row.module,
        表名: row.table,
        用途: row.note,
        记录数: row.record_count,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 32 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "数据库结构");
      XLSX.writeFile(wb, `hoc3-数据库结构-${fileTimestamp()}.xlsx`);
      toast.success("已导出数据库结构说明书");
    } catch (e: any) {
      toast.error(`导出失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        本功能用于更换后端、迁移服务器、重新部署时完整备份与恢复系统数据。恢复前请务必先备份当前数据。
      </div>

      {needsInit && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="mb-2">检测到系统暂无超级管理员。</p>
          <Button variant="destructive" disabled={busy} onClick={onInit}>
            初始化为超级管理员
          </Button>
        </div>
      )}

      {/* 一、备份 */}
      <section className="space-y-2">
        <h3 className="font-medium">📦 一键备份</h3>
        <p className="text-xs text-muted-foreground">
          导出全部 {Object.keys(GROUP_LABELS).length} 个模块共 {Object.keys(TABLE_NOTES).length} 张表为 JSON 文件，可下载保存到本地。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onPreviewBackup} disabled={busy}>
            {busy ? "处理中..." : "🔍 备份预览"}
          </Button>
          <Button onClick={onBackup} disabled={busy}>
            {busy ? "处理中..." : "📦 立即备份并下载"}
          </Button>
          <Button variant="outline" onClick={onExportSchema} disabled={busy}>
            📑 导出数据库说明书 (xlsx)
          </Button>
        </div>

        {backupPreview && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                将备份 {backupPreview.tableCount} 张表，共 {backupPreview.total} 条记录
              </span>
              <button
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => setBackupPreview(null)}
              >
                关闭
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded border bg-background">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-1.5 text-left">表</th>
                    <th className="p-1.5 text-left">用途</th>
                    <th className="p-1.5 text-right">记录数</th>
                  </tr>
                </thead>
                <tbody>
                  {backupPreview.tables.map((t: any) => (
                    <tr key={t.table} className="border-t">
                      <td className="p-1.5 font-mono">{t.table}</td>
                      <td className="p-1.5 text-muted-foreground">
                        {TABLE_NOTES[t.table] || ""}
                      </td>
                      <td className="p-1.5 text-right">
                        {t.error ? <span className="text-destructive">err</span> : t.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lastBackupSummary && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium mb-1">✅ 备份成功</p>
            <ul className="text-xs grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5">
              {Object.entries(lastBackupSummary)
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v]) => (
                  <li key={k}>
                    {k}（{v as number}条）
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      {/* 二、备份日志 */}
      <section className="space-y-2">
        <h3 className="font-medium">🕓 最近备份记录</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无备份记录。</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">时间</th>
                  <th className="p-2 text-left">创建人</th>
                  <th className="p-2 text-right">表数</th>
                  <th className="p-2 text-right">记录数</th>
                  <th className="p-2 text-right">大小</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">{fmtDate(l.created_at)}</td>
                    <td className="p-2">{l.creator_name || "—"}</td>
                    <td className="p-2 text-right">{l.total_tables}</td>
                    <td className="p-2 text-right">{l.total_records}</td>
                    <td className="p-2 text-right">{fmtBytes(l.file_size_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 三、恢复 */}
      <section className="space-y-3">
        <h3 className="font-medium">📥 一键恢复</h3>
        <p className="text-xs text-muted-foreground">
          选择恢复模式与要恢复的模块，上传 JSON 备份文件后会先做预检查，确认无误再恢复。
        </p>

        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-sm font-medium">恢复模式</Label>
          <RadioGroup
            value={restoreMode}
            onValueChange={(v) => setRestoreMode(v as "merge" | "replace")}
            className="flex flex-col sm:flex-row gap-3"
          >
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="merge" id="mode-merge" className="mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">🟢 合并模式（推荐）</div>
                <div className="text-xs text-muted-foreground">只新增不存在的数据，保留当前数据</div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">🔴 覆盖模式</div>
                <div className="text-xs text-muted-foreground">先清空再恢复（危险操作）</div>
              </div>
            </label>
          </RadioGroup>
        </div>

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
            {busy ? "处理中..." : "📥 选择备份文件"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
          className="hidden"
        />

        {restorePreview && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-2">
            <p className="font-medium text-amber-900">🔍 恢复预检查</p>
            <div className="text-xs space-y-0.5 text-amber-900">
              <div>项目名：{restorePreview.project_name ?? "未知"}</div>
              <div>备份时间：{restorePreview.created_at ? fmtDate(restorePreview.created_at) : "未知"}</div>
              <div>
                包含 {restorePreview.tableCount} 张表，共 {restorePreview.total} 条记录
              </div>
              <div>
                涉及模块：
                {restorePreview.modules?.length
                  ? restorePreview.modules.map((m: any) => m.label).join("、")
                  : "—"}
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto rounded border bg-background">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-1.5 text-left">表</th>
                    <th className="p-1.5 text-left">模块</th>
                    <th className="p-1.5 text-right">记录数</th>
                  </tr>
                </thead>
                <tbody>
                  {restorePreview.tables.map((t: any) => (
                    <tr key={t.table} className="border-t">
                      <td className="p-1.5 font-mono">
                        {t.table}
                        {!t.known && (
                          <span className="ml-1 text-amber-700">⚠ 未知</span>
                        )}
                      </td>
                      <td className="p-1.5 text-muted-foreground">
                        {t.module ? GROUP_LABELS[t.module] : "—"}
                      </td>
                      <td className="p-1.5 text-right">{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={onConfirmRestore} disabled={busy}>
                {busy ? "恢复中..." : `✅ 确认以${restoreMode === "merge" ? "合并" : "覆盖"}模式恢复`}
              </Button>
              <Button variant="outline" onClick={onCancelRestore} disabled={busy}>
                取消
              </Button>
            </div>
          </div>
        )}
      </section>

      {results && (
        <section className="space-y-2">
          <h3 className="font-medium">
            恢复结果（{results.mode === "merge" ? "合并模式" : "覆盖模式"}）
          </h3>
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
                  <th className="p-2 text-right">新增</th>
                  <th className="p-2 text-right">跳过</th>
                  <th className="p-2 text-right">失败</th>
                  <th className="p-2 text-left">说明</th>
                </tr>
              </thead>
              <tbody>
                {(results.results || []).map((r: any) => (
                  <tr key={r.table} className="border-t">
                    <td className="p-2 font-mono text-xs">{r.table}</td>
                    <td className="p-2 text-right">{r.inserted}</td>
                    <td className="p-2 text-right text-muted-foreground">{r.skipped ?? 0}</td>
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