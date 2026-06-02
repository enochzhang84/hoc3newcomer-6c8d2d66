import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  creator_name: string | null;
  is_active: boolean;
};

const DRAFT_KEY = "system-notification-draft";

export function NotificationBell({
  userId,
  isSuperAdmin,
  userEmail,
}: {
  userId: string | null;
  isSuperAdmin: boolean;
  userEmail: string;
}) {
  const [list, setList] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [detail, setDetail] = useState<Notification | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const load = useCallback(async () => {
    const { data: notifs } = await (supabase as any)
      .from("system_notifications")
      .select("id,title,content,created_at,creator_name,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);
    setList((notifs as Notification[]) ?? []);
    if (userId) {
      const { data: reads } = await (supabase as any)
        .from("user_notification_reads")
        .select("notification_id")
        .eq("user_id", userId);
      setReadIds(new Set(((reads as { notification_id: string }[]) ?? []).map((r) => r.notification_id)));
    }
  }, [userId]);

  useEffect(() => {
    void load();
    // load draft
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setTitle(d.title ?? "");
        setContent(d.content ?? "");
      }
    } catch {}
  }, [load]);

  // realtime
  useEffect(() => {
    const ch = (supabase as any)
      .channel("system_notifications_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_notifications" },
        () => { void load(); },
      )
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [load]);

  // Ctrl+~ shortcut for super_admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "`" || e.key === "~" || e.code === "Backquote")) {
        e.preventDefault();
        setComposerOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSuperAdmin]);

  const unreadCount = useMemo(
    () => list.filter((n) => !readIds.has(n.id)).length,
    [list, readIds],
  );

  async function markRead(id: string) {
    if (!userId || readIds.has(id)) return;
    setReadIds((s) => new Set(s).add(id));
    try {
      await (supabase as any)
        .from("user_notification_reads")
        .upsert({ user_id: userId, notification_id: id }, { onConflict: "user_id,notification_id" });
    } catch {}
  }

  async function openDetail(n: Notification) {
    setDetail(n);
    await markRead(n.id);
  }

  async function publish() {
    if (!title.trim()) {
      toast.error("请输入标题");
      return;
    }
    setSending(true);
    try {
      const { error } = await (supabase as any).from("system_notifications").insert({
        title: title.trim(),
        content: content.trim(),
        created_by: userId,
        creator_name: userEmail || null,
        is_active: true,
      });
      if (error) throw error;
      toast.success("已推送系统通知");
      setTitle("");
      setContent("");
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setComposerOpen(false);
      void load();
    } catch (e) {
      toast.error("推送失败：" + (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content }));
      toast.success("草稿已保存");
    } catch {
      toast.error("草稿保存失败");
    }
  }

  function formatTime(s: string) {
    try {
      const d = new Date(s);
      return d.toLocaleString("zh-CN", { hour12: false });
    } catch { return s; }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-border/60 bg-background hover:bg-muted transition-colors"
            title="系统通知"
            aria-label="系统通知"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] p-0">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-sm font-semibold">📢 系统通知</div>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => { setOpen(false); setComposerOpen(true); }}
                className="text-xs text-primary hover:underline"
                title="Ctrl + ~ 快捷推送"
              >
                + 新公告
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {list.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">暂无通知</div>
            ) : (
              list.map((n) => {
                const unread = !readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "px-4 py-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors",
                      unread && "bg-primary/5",
                    )}
                    onClick={() => openDetail(n)}
                  >
                    <div className="flex items-start gap-2">
                      {unread && <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatTime(n.created_at)}</div>
                        {n.content && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{n.content}</div>
                        )}
                        <button
                          type="button"
                          className="text-xs text-primary mt-1 hover:underline"
                          onClick={(e) => { e.stopPropagation(); void openDetail(n); }}
                        >
                          查看详情 →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* 详情弹窗 */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {formatTime(detail.created_at)}
                {detail.creator_name && <> · 发布人：{detail.creator_name}</>}
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{detail.content || "（无内容）"}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>关闭</Button>
            {isSuperAdmin && detail && (
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm("确定删除此通知？")) return;
                  await (supabase as any).from("system_notifications").delete().eq("id", detail.id);
                  setDetail(null);
                  void load();
                }}
              >
                删除
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 推送编辑窗口 */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>📢 系统推送 <span className="text-xs font-normal text-muted-foreground ml-2">Ctrl + ~</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">标题</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：厨房统计中心上线"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">内容</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="例如：新增厨房服侍排行榜&#10;新增年度服侍统计&#10;新增月度服侍统计"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setComposerOpen(false)}>取消</Button>
            <Button variant="outline" onClick={saveDraft}>保存草稿</Button>
            <Button onClick={publish} disabled={sending}>{sending ? "推送中..." : "推送"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}