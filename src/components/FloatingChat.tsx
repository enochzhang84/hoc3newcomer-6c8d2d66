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

// Single source of truth: user_presence table. All devices see the same
// online list because everyone uses the same heartbeat + window + realtime
// subscription. Heartbeat every 15s, considered offline after 60s.
const HEARTBEAT_MS = 15 * 1000;
const PRESENCE_REFRESH_MS = 20 * 1000;
const PRESENCE_WINDOW_MS = 60 * 1000;
const UNREAD_KEY = "floating_chat_last_read_at";
const HIDDEN_KEY = "floating_chat_hidden";
const POS_KEY = "floating_chat_pos";
const SHOW_EVENT = "floating-chat:show";

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
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HIDDEN_KEY) === "1";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
    } catch {
      return null;
    }
  });
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<WorkerOption | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState("");
  const [chooserTarget, setChooserTarget] = useState<WorkerOption | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const publicListRef = useRef<HTMLDivElement>(null);
  const privateListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  const displayName = workerName.trim() || email || "匿名";

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Listen for global "show" event (toolbar button) to re-display hidden icon
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onShow = () => {
      window.localStorage.removeItem(HIDDEN_KEY);
      setHidden(false);
    };
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  }, []);

  const hideIcon = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(HIDDEN_KEY, "1");
    setHidden(true);
    setMenuOpen(false);
  };

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
      if (!stopped) loadPresence();
    };
    heartbeat();
    const hb = setInterval(heartbeat, HEARTBEAT_MS);
    // Best-effort: clear presence row on tab close / sign-out
    const clearPresence = () => {
      try {
        (supabase as any).from("user_presence").delete().eq("user_id", userId);
      } catch {}
    };
    const onBeforeUnload = () => clearPresence();
    const onVisibility = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearInterval(hb);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, workerName, displayName, loadPresence]);

  // Realtime subscription: every device updates the moment presence changes
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("user_presence_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => loadPresence(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, loadPresence]);

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

  const focusInput = () => {
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
    }, 0);
  };

  const matchesWorker = (w: WorkerOption, q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return false;
    const name = (w.worker_name || "").toLowerCase();
    const disp = (w.display_name || "").toLowerCase();
    return name.includes(s) || disp.includes(s);
  };
  const searchMatches = search.trim()
    ? workers.filter((w) => w.user_id !== userId && matchesWorker(w, search))
    : [];

  const startPublicMention = (w: WorkerOption) => {
    const name = w.worker_name?.trim() || w.display_name?.trim() || "";
    if (!name) return;
    setMentionTarget(null);
    setInput((prev) => {
      const stripped = prev.replace(/^@[^\s@]+\s*/, "");
      const tag = `@${name} `;
      return stripped.startsWith(tag) ? stripped : tag + stripped;
    });
    setSearch("");
    setChooserTarget(null);
    focusInput();
  };

  const startPrivateChat = (w: WorkerOption) => {
    const name = w.worker_name?.trim() || w.display_name?.trim() || "";
    if (!name || w.user_id === userId) return;
    setMentionTarget(w);
    setInput((prev) => {
      const stripped = prev.replace(/^@[^\s@]+\s*/, "");
      const tag = `@${name} `;
      return stripped.startsWith(tag) ? stripped : tag + stripped;
    });
    setSearch("");
    setChooserTarget(null);
    focusInput();
  };

  const handleSearchEnter = () => {
    const q = search.trim();
    if (!q) return;
    if (searchMatches.length === 0) {
      toast.error("未找到该同工");
      return;
    }
    setChooserTarget(searchMatches[0]);
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
  if (hidden && !open) return null;

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
        <div
          key={m.id}
          role="button"
          tabIndex={0}
          onClick={() => startReply(partner)}
          onContextMenu={(e) => { if (canDelete(m)) { e.preventDefault(); setActionId(m.id); } }}
          onTouchStart={() => startLongPress(m)}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
          className={"group relative w-full text-left rounded-2xl px-3 py-2 transition-colors hover:brightness-95 cursor-pointer " + cardClass}
        >
          <div className="flex items-center gap-2 mb-1 min-w-0">
            <div className={"h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-medium " + iconClass}>
              {initial}
            </div>
            <div className="flex-1 min-w-0 text-xs font-medium truncate">{title}</div>
            <div className="text-[10px] opacity-70 shrink-0">{time}</div>
            <DeleteBtn m={m} />
          </div>
          <div className="text-sm whitespace-pre-wrap break-words pl-8">{m.content}</div>
        </div>
      );
    }

    const bubbleClass = mine ? "bg-primary text-primary-foreground" : "bg-muted";
    const metaClass = "text-[10px] mb-0.5 " + (mine ? "text-primary-foreground/80" : "text-muted-foreground");
    return (
      <div key={m.id} className={"group flex items-start gap-1 " + (mine ? "justify-end" : "justify-start")}>
        {mine && <DeleteBtn m={m} className="self-center" />}
        <div
          onContextMenu={(e) => { if (canDelete(m)) { e.preventDefault(); setActionId(m.id); } }}
          onTouchStart={() => startLongPress(m)}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
          className={"max-w-[85%] rounded-2xl px-3 py-1.5 " + bubbleClass}
        >
          <div className={"flex items-baseline gap-2 " + metaClass}>
            <span className="font-medium">{m.display_name}</span>
            <span>{time}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
        </div>
        {!mine && <DeleteBtn m={m} className="self-center" />}
      </div>
    );
  };

  // Floating icon position style: use saved drag pos when available, else default bottom-right
  const containerStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : {};
  const containerClass = pos
    ? "z-[60] print:hidden"
    : "fixed z-[60] bottom-4 right-4 sm:bottom-6 sm:right-6 print:hidden";

  const onIconPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // left button only
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    dragRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, moved: false };
    btn.setPointerCapture(e.pointerId);
  };
  const onIconPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = e.clientX - d.x;
    const ny = e.clientY - d.y;
    if (!d.moved) {
      const dx = Math.abs(e.clientX - (d.x + (pos?.x ?? 0)));
      const dy = Math.abs(e.clientY - (d.y + (pos?.y ?? 0)));
      if (dx > 4 || dy > 4) d.moved = true;
    }
    if (d.moved) {
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      const clamped = { x: Math.max(0, Math.min(maxX, nx)), y: Math.max(0, Math.min(maxY, ny)) };
      setPos(clamped);
    }
  };
  const onIconPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (d?.moved && pos) {
      try { window.localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
    } else {
      // Treat as click
      setOpen(true);
      markAllRead();
    }
  };

  return (
    <div className={containerClass} style={containerStyle}>
      {!open && (
        <div className="relative">
          <button
            onPointerDown={onIconPointerDown}
            onPointerMove={onIconPointerMove}
            onPointerUp={onIconPointerUp}
            onContextMenu={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
            aria-label="打开聊天（右键可隐藏）"
            title="左键点击打开 / 拖动移动 / 右键隐藏"
            className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
          >
            <MessageCircle className="h-6 w-6 pointer-events-none" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center pointer-events-none">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[65]" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-[66]">
                <button
                  onClick={hideIcon}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                >
                  隐藏聊天图标
                </button>
              </div>
            </>
          )}
        </div>
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
            <div className="flex items-center gap-1">
              {isAdmin && (
                <button
                  onClick={clearScreen}
                  aria-label="清空屏幕"
                  title="清空屏幕"
                  className="px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  清屏
                </button>
              )}
              <button
                onClick={() => { setOpen(false); markAllRead(); }}
                aria-label="关闭"
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-border/50">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSearchEnter(); }
              }}
              placeholder="搜索同工姓名或消息内容…"
              className="h-8 text-xs"
            />
            {search.trim() && searchMatches.length > 0 && (
              <div className="mt-2 bg-popover border border-border rounded-md shadow-sm max-h-40 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/40">
                  找到 {searchMatches.length} 位同工 · 点击发起聊天
                </div>
                {searchMatches.slice(0, 8).map((w) => {
                  const online = onlineIds.has(w.user_id);
                  return (
                    <button
                      key={w.user_id}
                      onClick={() => setChooserTarget(w)}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm hover:bg-muted border-t border-border/40 first:border-0"
                    >
                      <span className="truncate">{w.worker_name || w.display_name || "(未命名)"}</span>
                      <span className={"h-2 w-2 rounded-full shrink-0 " + (online ? "bg-green-500" : "bg-gray-400")} />
                    </button>
                  );
                })}
              </div>
            )}
            {search.trim() && searchMatches.length === 0 && (
              <div className="mt-2 text-[11px] text-muted-foreground px-1">未找到该同工</div>
            )}
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

      {pendingDelete && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={() => setPendingDelete(null)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-1">确认删除该条消息？</div>
            <div className="text-xs text-muted-foreground mb-3 break-words line-clamp-3">{pendingDelete.content}</div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>取消</Button>
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>删除</Button>
            </div>
          </div>
        </div>
      )}

      {chooserTarget && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={() => setChooserTarget(null)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-1">
              与 <span className="text-primary">{chooserTarget.worker_name || chooserTarget.display_name}</span> 发起聊天
            </div>
            <div className="text-xs text-muted-foreground mb-4">请选择聊天方式：</div>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => startPublicMention(chooserTarget)}>
                公屏聊天 @{chooserTarget.worker_name || chooserTarget.display_name}
              </Button>
              <Button size="sm" variant="outline" onClick={() => startPrivateChat(chooserTarget)}>
                私聊：{chooserTarget.worker_name || chooserTarget.display_name}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setChooserTarget(null)}>取消</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}