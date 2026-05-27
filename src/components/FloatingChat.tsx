import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MessageCircle, X, Users, Send } from "lucide-react";

type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

type PresenceMeta = {
  user_id: string;
  display_name: string;
  online_at: string;
};

export function FloatingChat() {
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [open, setOpen] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState<PresenceMeta[]>([]);
  const [contactNames, setContactNames] = useState<Map<string, string>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);

  const displayName =
    contactNames.get((workerName || email).trim().toLowerCase()) ||
    workerName.trim() ||
    email ||
    "匿名";

  // Auth bootstrap
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("worker_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!cancelled && profile?.worker_name) setWorkerName(profile.worker_name);
      // Load contact names for display preference
      const { data: contacts } = await supabase.from("contacts").select("name");
      if (!cancelled && contacts) {
        const m = new Map<string, string>();
        for (const c of contacts) {
          if (c.name) m.set(c.name.toLowerCase(), c.name);
        }
        setContactNames(m);
      }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Listen for external open requests (e.g. from admin "聊天" button)
  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("toggle-floating-chat", handler);
    return () => window.removeEventListener("toggle-floating-chat", handler);
  }, []);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return;
    setMessages(((data ?? []) as ChatMessage[]).reverse());
  }, []);

  // Realtime messages
  useEffect(() => {
    if (!authed) return;
    loadMessages();
    const channel = supabase
      .channel("chat_messages_floating")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => loadMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, loadMessages]);

  // Presence (online tracking)
  useEffect(() => {
    if (!authed || !userId) return;
    const channel = supabase.channel("presence_online", {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const list: PresenceMeta[] = [];
        for (const key of Object.keys(state)) {
          const metas = state[key];
          if (metas && metas.length > 0) list.push(metas[0]);
        }
        setOnline(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            display_name: displayName,
            online_at: new Date().toISOString(),
          });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, userId, displayName]);

  // Auto-scroll to latest
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async () => {
    const content = input.trim();
    if (!content || !userId) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      user_id: userId,
      display_name: displayName,
      content,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setInput("");
  };

  if (!authed) return null;

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="打开聊天"
          className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="h-6 w-6" />
          {online.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-medium flex items-center justify-center shadow">
              {online.length}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-50 bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden
                     bottom-4 right-4 left-4 sm:left-auto
                     w-auto sm:w-[380px]
                     h-[min(70vh,560px)] sm:h-[560px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-[#fdf9f1]">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="font-serif text-sm truncate">同工聊天</div>
                <div className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  在线 {online.length} 人
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowRoster((v) => !v)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="在线名单"
                title="在线名单"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="收起"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Roster panel */}
          {showRoster && (
            <div className="border-b border-border/50 bg-muted/30 px-4 py-2 max-h-32 overflow-y-auto">
              <div className="text-[11px] text-muted-foreground mb-1">在线同工</div>
              {online.length === 0 ? (
                <div className="text-xs text-muted-foreground/70">暂无在线</div>
              ) : (
                <ul className="space-y-1">
                  {online.map((p) => (
                    <li key={p.user_id} className="flex items-center gap-2 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="truncate">{p.display_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-background/50">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">暂无消息，开始聊天吧</p>
            ) : (
              messages.map((m) => {
                const mine = m.user_id === userId;
                return (
                  <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-3 py-1.5 " +
                        (mine ? "bg-primary text-primary-foreground" : "bg-muted")
                      }
                    >
                      <div
                        className={
                          "flex items-baseline gap-2 text-[10px] mb-0.5 " +
                          (mine ? "text-primary-foreground/80" : "text-muted-foreground")
                        }
                      >
                        <span className="font-medium truncate max-w-[120px]">{m.display_name}</span>
                        <span>
                          {new Date(m.created_at).toLocaleString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words leading-snug">
                        {m.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/50 p-2 flex gap-2 bg-card">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`以「${displayName}」身份发送`}
              disabled={sending}
              className="flex-1 h-9 text-sm"
            />
            <Button onClick={send} disabled={sending || !input.trim()} size="sm" className="h-9 px-3">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}