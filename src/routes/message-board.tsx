import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/message-board")({
  component: MessageBoardPage,
  head: () => ({
    meta: [{ title: "留言板" }],
  }),
});

const STORAGE_KEY = "lovable-message-board";

function MessageBoardPage() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) ?? "" : "";
    setText(v);
    setSaved(v);
  }, []);

  // cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const v = e.newValue ?? "";
        setText(v);
        setSaved(v);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const dirty = text !== saved;

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, text);
    setSaved(text);
    toast.success("已保存");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="font-serif text-xl">留言板</h1>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-muted-foreground">未保存</span>}
            <Button size="sm" onClick={save} disabled={!dirty}>
              保存
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此输入留言内容..."
          className="min-h-[70vh] text-base leading-relaxed"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          内容保存在本浏览器,关闭页面后下次打开仍然可见。
        </p>
      </main>
    </div>
  );
}