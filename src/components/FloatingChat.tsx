import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
  recipient_id: string | null;
};

type WorkerOption = {
  user_id: string;
  worker_name: string | null;
  display_name: string | null;
};

const HEARTBEAT_MS = 30 * 1000;
const PRESENCE_REFRESH_MS = 30 * 1000;
const PRESENCE_WINDOW_MS = 5 * 60 * 1000;
const UNREAD_KEY = "floating_chat_last_read_at";

export function FloatingChat() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<WorkerOption | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState("");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const publicListRef = useRef<HTMLDivElement>(null);
  const privateListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  const displayName = workerName.trim() || email || "匿名";

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const getLastRead = () => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(UNREAD_KEY) : null;
    return v ? new Date(v).getTime() : 0;
  };
  const markAllRead = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UNREAD_KEY, new Date().toISOString());
    }
    setUnread(0);
  };

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,user_id,display_name,content,created_at,recipient_id")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return;
    const list = ((data ?? []) as ChatMessage[]).slice().reverse();
    setMessages(list);
    // Recompute unread from loaded list
    const me = userIdRef.current;
    const lastRead = getLastRead();
    const count = list.filter((m) =>
      m.user_id !== me &&
      (m.recipient_id === null || m.recipient_id === me) &&
      new Date(m.created_at).getTime() > lastRead,
    ).length;
    if (openRef.current) {
      markAllRead();
    } else {
      setUnread(count);
    }
  }, []);

  const loadWorkers = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("user_profiles")
      .select("user_id,worker_name");
    setWorkers((data ?? []) as WorkerOption[]);
  }, []);

  const loadPresence = useCallback(async () => {
    const since = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
    const { data } = await (supabase as any)
      .from("user_presence")
      .select("user_id,last_seen_at")
      .gte("last_seen_at", since);
    setOnlineIds(new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id)));
  }, []);

  // Initial auth + load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: profile } = await (supabase as any)
        .from("user_profiles")
        .select("worker_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (profile?.worker_name) setWorkerName(profile.worker_name);
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const rs = (roles ?? []) as { role: string }[];
      setIsAdmin(rs.some((r) => r.role === "admin" || r.role === "super_admin"));
      loadWorkers();
      loadPresence();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWorkers, loadPresence]);

  // Refresh presence periodically
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(loadPresence, PRESENCE_REFRESH_MS);
    return () => clearInterval(id);
  }, [userId, loadPresence]);

  // Heartbeat (keep presence updated for admin online dots)
  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    const heartbeat = async () => {
      if (stopped) return;
      await (supabase as any).from("user_presence").upsert(
        {
          user_id: userId,
          worker_name: workerName || null,
          display_name: displayName,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    };
    heartbeat();
    const hb = setInterval(heartbeat, HEARTBEAT_MS);
    return () => {
      stopped = true;
      clearInterval(hb);
    };
  }, [userId, workerName, displayName]);

  // Load messages on first open + subscribe realtime
  useEffect(() => {
    if (!userId) return;
    loadMessages();
    const channel = supabase
      .channel("floating_chat_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => loadMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadMessages]);

  useEffect(() => {
    if (open) {
      if (publicListRef.current) publicListRef.current.scrollTop = publicListRef.current.scrollHeight;
      if (privateListRef.current) privateListRef.current.scrollTop = privateListRef.current.scrollHeight;
      markAllRead();
    }
  }, [messages, open]);

  // Parse @ mention from input
  useEffect(() => {
    const match = input.match(/@([^\s@]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
    // Clear mention target if its name no longer in input
    if (mentionTarget) {
      const tag = "@" + (mentionTarget.worker_name || "");
      if (!input.includes(tag)) setMentionTarget(null);
    }
  }, [input, mentionTarget]);

  const pickMention = (w: WorkerOption) => {
    const name = w.worker_name?.trim() || "";
    if (!name) return;
    const next = input.replace(/@([^\s@]*)$/, "@" + name + " ");
    setInput(next);
    setMentionTarget(w);
    setMentionQuery(null);
  };

  const startReply = (w: WorkerOption) => {
    const name = w.worker_name?.trim() || w.display_name?.trim() || "";
    if (!name || w.user_id === userId) return;
    const tag = "@" + name + " ";
    setInput((prev) => (prev.includes(tag) ? prev : tag));
    setMentionTarget(w);
    setMentionQuery(null);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        try { el.setSelectionRange(len, len); } catch { /* noop */ }
      }
    }, 0);
  };

  const cancelReply = () => {
    setMentionTarget(null);
    setInput((prev) => prev.replace(/^@[^\s@]+\s*/, ""));
    setMentionQuery(null);
  };

  const send = async () => {
    const content = input.trim();
    if (!content || !userId) return;
    setSending(true);
    const { error } = await (supabase as any).from("chat_messages").insert({
      user_id: userId,
      display_name: displayName,
      content,
      recipient_id: mentionTarget?.user_id ?? null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setInput("");
    setMentionTarget(null);
  };

  const canDelete = (m: ChatMessage) => isAdmin || m.user_id === userId;

  const handleDelete = async () => {
    const m = pendingDelete;
    if (!m) return;
    setPendingDelete(null);
    const { error } = await (supabase as any).from("chat_messages").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    setActionId(null);
  };

  const clearScreen = () => {
    if (!isAdmin) return;
    if (!window.confirm("清空当前聊天屏幕显示？不会删除数据库消息。")) return;
    setHiddenIds(new Set(messages.map((m) => m.id)));
  };

  const startLongPress = (m: ChatMessage) => {
    if (!canDelete(m)) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setActionId(m.id), 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (!userId) return null;

  const filteredWorkers = (mentionQuery !== null
    ? workers.filter(
        (w) =>
          w.user_id !== userId &&
          (w.worker_name || "").toLowerCase().includes(mentionQuery.toLowerCase()),
      )
    : []
  ).slice(0, 6);

  const workerNameById = (id: string) => {
    const w = workers.find((x) => x.user_id === id);
    return w?.worker_name?.trim() || w?.display_name || "同工";
  };

  const onlineCount = onlineIds.size;
  const q = search.trim().toLowerCase();
  const matchesSearch = (m: ChatMessage) =>
    !q ||
    m.display_name.toLowerCase().includes(q) ||
    m.content.toLowerCase().includes(q);
  const publicMessages = messages.filter(
    (m) => m.recipient_id === null && matchesSearch(m) && !hiddenIds.has(m.id),
  );
  const privateMessages = messages.filter(
    (m) =>
      m.recipient_id !== null &&
      (m.user_id === userId || m.recipient_id === userId) &&
      matchesSearch(m) &&
      !hiddenIds.has(m.id),
  );

  const DeleteBtn = ({ m, className = "" }: { m: ChatMessage; className?: string }) =>
    canDelete(m) ? (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPendingDelete(m); }}
        aria-label="删除消息"
        className={
          "shrink-0 p-1 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600 transition-opacity " +
          (actionId === m.id ? "opacity-100 " : "opacity-0 group-hover:opacity-100 ") +
          className
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    ) : null;

  const renderBubble = (m: ChatMessage) => {
    const mine = m.user_id === userId;
    const isPrivate = !!m.recipient_id;
    const time = new Date(m.created_at).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" });

    if (isPrivate) {
      const otherName = mine ? workerNameById(m.recipient_id!) : m.display_name;
      const title = mine ? `我 私聊给 ${otherName}` : `${otherName} 私聊给我`;
      const cardClass = mine
        ? "bg-amber-50 border border-amber-200 text-amber-950"
        : "bg-sky-50 border border-sky-200 text-sky-950";
      const iconClass = mine ? "bg-amber-200 text-amber-900" : "bg-sky-200 text-sky-900";
      const initial = (mine ? "我" : otherName || "私").slice(0, 1);
      const partnerId = mine ? m.recipient_id! : m.user_id;
      const partner: WorkerOption =
        workers.find((w) => w.user_id === partnerId) ?? {
          user_id: partnerId,
          worker_name: otherName,
          display_name: otherName,
        };
      return (
        <button
          type="button"
          key={m.id}
          onClick={() => startReply(partner)}
          className={"w-full text-left rounded-2xl px-3 py-2 transition-colors hover:brightness-95 " + cardClass}
        >
          <div className="flex items-center gap-2 mb-1 min-w-0">
            <div className={"h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-medium " + iconClass}>
              {initial}
            </div>
            <div className="flex-1 min-w-0 text-xs font-medium truncate">{title}</div>
            <div className="text-[10px] opacity-70 shrink-0">{time}</div>
          </div>
          <div className="text-sm whitespace-pre-wrap break-words pl-8">{m.content}</div>
        </button>
      );
    }

    const bubbleClass = mine ? "bg-primary text-primary-foreground" : "bg-muted";
    const metaClass = "text-[10px] mb-0.5 " + (mine ? "text-primary-foreground/80" : "text-muted-foreground");
    return (
      <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
        <div className={"max-w-[85%] rounded-2xl px-3 py-1.5 " + bubbleClass}>
          <div className={"flex items-baseline gap-2 " + metaClass}>
            <span className="font-medium">{m.display_name}</span>
            <span>{time}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed z-[60] bottom-4 right-4 sm:bottom-6 sm:right-6 print:hidden">
      {!open && (
        <button
          onClick={() => { setOpen(true); markAllRead(); }}
          aria-label="打开聊天"
          className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            width: "min(400px, calc(100vw - 2rem))",
            height: "min(620px, calc(100vh - 6rem))",
          }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
            <div className="min-w-0 flex items-center gap-2">
              <div className="font-serif text-sm sm:text-base truncate">同工聊天</div>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                在线 {onlineCount} 人
              </span>
            </div>
            <button
              onClick={() => { setOpen(false); markAllRead(); }}
              aria-label="关闭"
              className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-border/50">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索同工姓名或消息内容…"
              className="h-8 text-xs"
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground bg-muted/20">
              <span>公屏</span>
              <span>{publicMessages.length} 条</span>
            </div>
            <div ref={publicListRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
              {publicMessages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">暂无公屏消息</p>
              ) : (
                publicMessages.map(renderBubble)
              )}
            </div>

            <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground bg-amber-50 border-t border-border/50">
              <span>私聊</span>
              <span>{privateMessages.length} 条</span>
            </div>
            <div ref={privateListRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 bg-amber-50/30">
              {privateMessages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">暂无私聊消息</p>
              ) : (
                privateMessages.map(renderBubble)
              )}
            </div>
          </div>

          <div className="border-t border-border/50 p-2 relative">
            {mentionQuery !== null && filteredWorkers.length > 0 && (
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                {filteredWorkers.map((w) => {
                  const online = onlineIds.has(w.user_id);
                  return (
                    <button
                      key={w.user_id}
                      onClick={() => pickMention(w)}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      <span>@{w.worker_name}</span>
                      <span className={"h-2 w-2 rounded-full " + (online ? "bg-green-500" : "bg-gray-400")} />
                    </button>
                  );
                })}
              </div>
            )}
            {mentionTarget && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-amber-700 mb-1 px-1">
                <span>正在回复：<span className="font-medium">{mentionTarget.worker_name}</span></span>
                <button
                  type="button"
                  onClick={cancelReply}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  取消回复
                </button>
              </div>
            )}
            <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={mentionTarget ? `回复 ${mentionTarget.worker_name}` : `公屏：以「${displayName}」发送…`}
              disabled={sending}
              className="flex-1 h-9 text-sm"
            />
            <Button onClick={send} disabled={sending || !input.trim()} size="sm">发送</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}