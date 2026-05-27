import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Users } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

type PresenceRow = {
  user_id: string;
  worker_name: string | null;
  display_name: string | null;
  last_seen_at: string;
};

const PRESENCE_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

export function FloatingChat() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [open, setOpen] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const displayName = workerName.trim() || email || "匿名";

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return;
    setMessages(((data ?? []) as ChatMessage[]).slice().reverse());
  }, []);

  const loadPresence = useCallback(async () => {
    const since = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
    const { data } = await (supabase as any)
      .from("user_presence")
      .select("*")
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false });
    setPresence((data ?? []) as PresenceRow[]);
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Heartbeat + presence polling
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
    loadPresence();
    const hb = setInterval(heartbeat, HEARTBEAT_MS);
    const pp = setInterval(loadPresence, HEARTBEAT_MS);
    return () => {
      stopped = true;
      clearInterval(hb);
      clearInterval(pp);
    };
  }, [userId, workerName, displayName, loadPresence]);

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
    }
  }, [messages, open]);

  const send = async () => {
    const content = input.trim();
    if (!content || !userId) return;
    setSending(true);
    const { error } = await (supabase as any).from("chat_messages").insert({
      user_id: userId,
      display_name: displayName,
      content,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setInput("");
  };

  if (!userId) return null;

  const onlineCount = presence.length;

  return (
    <div className="fixed z-[60] bottom-4 right-4 sm:bottom-6 sm:right-6 print:hidden">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="打开聊天"
          className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
          {onlineCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-green-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {onlineCount}
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
              <button
                onClick={() => setShowRoster((v) => !v)}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                在线 {onlineCount} 人
                <Users className="h-3 w-3 ml-1" />
              </button>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="关闭"
              className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showRoster && (
            <div className="max-h-32 overflow-y-auto border-b border-border/40 bg-muted/10 px-3 py-2 text-xs space-y-1">
              {presence.length === 0 && (
                <div className="text-muted-foreground">暂无在线同工</div>
              )}
              {presence.map((p) => (
                <div key={p.user_id} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <span className="truncate">{p.worker_name?.trim() || p.display_name || "匿名"}</span>
                </div>
              ))}
            </div>
          )}

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">暂无消息</p>
            )}
            {messages.map((m) => {
              const mine = m.user_id === userId;
              return (
                <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                  <div className={"max-w-[80%] rounded-2xl px-3 py-1.5 " + (mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <div className={"flex items-baseline gap-2 text-[10px] mb-0.5 " + (mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      <span className="font-medium">{m.display_name}</span>
                      <span>{new Date(m.created_at).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" })}</span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/50 p-2 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`以「${displayName}」发送…`}
              disabled={sending}
              className="flex-1 h-9 text-sm"
            />
            <Button onClick={send} disabled={sending || !input.trim()} size="sm">发送</Button>
          </div>
        </div>
      )}
    </div>
  );
}