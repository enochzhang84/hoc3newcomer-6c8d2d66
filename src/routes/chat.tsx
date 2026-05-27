import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "同工聊天" }] }),
});

type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

function ChatPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [workerName, setWorkerName] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const displayName = workerName.trim() || email || "匿名";

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return toast.error(error.message);
    setMessages((data ?? []) as ChatMessage[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate({ to: "/login" });
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("worker_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (profile?.worker_name) setWorkerName(profile.worker_name);
      loadMessages();
    })();
  }, [navigate, loadMessages]);

  useEffect(() => {
    const channel = supabase
      .channel("chat_messages_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => loadMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMessages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

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

  return (
    <div className="min-h-screen bg-[#fdf9f1] py-6 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50">
          <div>
            <h1 className="font-serif text-lg sm:text-xl">同工聊天</h1>
            <p className="text-xs text-muted-foreground">当前同工：<span className="font-medium text-foreground">{displayName}</span></p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin" })}>返回</Button>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">暂无消息，开始聊天吧</p>
          )}
          {messages.map((m) => {
            const mine = m.user_id === userId;
            return (
              <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                <div className={"max-w-[80%] rounded-2xl px-3 py-2 " + (mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <div className={"flex items-baseline gap-2 text-xs mb-1 " + (mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    <span className="font-medium">{m.display_name}</span>
                    <span>{new Date(m.created_at).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" })}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border/50 p-3 sm:p-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="输入消息，按 Enter 发送"
            disabled={sending || !userId}
            className="flex-1"
          />
          <Button onClick={send} disabled={sending || !input.trim() || !userId}>发送</Button>
        </div>
      </div>
    </div>
  );
}