import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X } from "lucide-react";
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
const UNREAD_KEY = "floating_chat_last_read_at";

export function FloatingChat() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<WorkerOption | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
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
      loadWorkers();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWorkers]);

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
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
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
            width: "min(380px, calc(100vw - 2rem))",
            height: "min(560px, calc(100vh - 6rem))",
          }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
            <div className="min-w-0">
              <div className="font-serif text-sm sm:text-base truncate">同工聊天</div>
              <div className="text-xs text-muted-foreground">
                输入 @ 可私聊指定同工，否则发送到公屏
              </div>
            </div>
            <button
              onClick={() => { setOpen(false); markAllRead(); }}
              aria-label="关闭"
              className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">暂无消息</p>
            )}
            {messages.map((m) => {
              const mine = m.user_id === userId;
              const isPrivate = !!m.recipient_id;
              const bubbleClass = isPrivate
                ? mine
                  ? "bg-amber-200 text-amber-950 border border-amber-300"
                  : "bg-sky-100 text-sky-950 border border-sky-200"
                : mine
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted";
              const metaClass = isPrivate
                ? "text-[10px] mb-0.5 opacity-80"
                : "text-[10px] mb-0.5 " + (mine ? "text-primary-foreground/80" : "text-muted-foreground");
              const tag = isPrivate
                ? mine
                  ? `私聊给：${workerNameById(m.recipient_id!)}`
                  : `来自：${m.display_name}（私聊）`
                : null;
              return (
                <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                  <div className={"max-w-[80%] rounded-2xl px-3 py-1.5 " + bubbleClass}>
                    <div className={"flex items-baseline gap-2 " + metaClass}>
                      <span className="font-medium">{m.display_name}</span>
                      <span>{new Date(m.created_at).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" })}</span>
                    </div>
                    {tag && <div className="text-[10px] font-medium mb-0.5">{tag}</div>}
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/50 p-2 relative">
            {mentionQuery !== null && filteredWorkers.length > 0 && (
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                {filteredWorkers.map((w) => (
                  <button
                    key={w.user_id}
                    onClick={() => pickMention(w)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    @{w.worker_name}
                  </button>
                ))}
              </div>
            )}
            {mentionTarget && (
              <div className="text-[11px] text-amber-700 mb-1 px-1">
                将私聊给：<span className="font-medium">{mentionTarget.worker_name}</span>
              </div>
            )}
            <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={mentionTarget ? `私聊 @${mentionTarget.worker_name}` : `公屏：以「${displayName}」发送…`}
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