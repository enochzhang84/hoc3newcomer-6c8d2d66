import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/message-board")({
  component: MessageBoardPage,
  head: () => ({
    meta: [{ title: "留言板" }],
  }),
});

const STORAGE_KEY = "lovable-message-board-list";

type Message = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveMessages(list: Message[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function MessageBoardPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setMessages(loadMessages());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setMessages(loadMessages());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const openCreate = () => {
    setEditingId(null);
    setDraftTitle("");
    setDraftContent("");
    setEditorOpen(true);
  };

  const openEdit = () => {
    if (!selected) {
      toast.error("请先选择一条留言");
      return;
    }
    setEditingId(selected.id);
    setDraftTitle(selected.title);
    setDraftContent(selected.content);
    setEditorOpen(true);
  };

  const handleSave = () => {
    const title = draftTitle.trim();
    if (!title) {
      toast.error("请输入标题");
      return;
    }
    let next: Message[];
    if (editingId) {
      next = messages.map((m) =>
        m.id === editingId
          ? { ...m, title, content: draftContent, updatedAt: Date.now() }
          : m,
      );
    } else {
      const newMsg: Message = {
        id: crypto.randomUUID(),
        title,
        content: draftContent,
        updatedAt: Date.now(),
      };
      next = [newMsg, ...messages];
      setSelectedId(newMsg.id);
    }
    setMessages(next);
    saveMessages(next);
    setEditorOpen(false);
    toast.success("已保存");
  };

  const askDelete = () => {
    if (!selected) {
      toast.error("请先选择一条留言");
      return;
    }
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!selected) return;
    const next = messages.filter((m) => m.id !== selected.id);
    setMessages(next);
    saveMessages(next);
    setSelectedId(null);
    setDeleteOpen(false);
    toast.success("已删除");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <h1 className="font-serif text-2xl">留言板</h1>
        </div>
      </header>
      <main className="container mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openCreate}>
            <Plus /> 创建留言
          </Button>
          <Button variant="outline" onClick={openEdit} disabled={!selected}>
            <Pencil /> 编辑留言
          </Button>
          <Button variant="destructive" onClick={askDelete} disabled={!selected}>
            <Trash2 /> 删掉留言
          </Button>
          {selected && (
            <span className="ml-2 text-sm text-muted-foreground">
              已选择:{selected.title}
            </span>
          )}
        </div>

        {messages.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            还没有留言,点击"创建留言"开始。
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {messages.map((m) => {
              const active = m.id === selectedId;
              return (
                <Card
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`cursor-pointer p-4 transition-colors hover:bg-accent/40 ${
                    active ? "border-primary ring-1 ring-primary" : ""
                  }`}
                >
                  <div className="font-medium truncate">{m.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {m.content || "(无内容)"}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {new Date(m.updatedAt).toLocaleString()}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          内容保存在本浏览器,关闭页面后下次打开仍然可见。
        </p>
      </main>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑留言" : "创建留言"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="标题"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
            <Textarea
              placeholder="内容"
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="min-h-[220px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除?</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除留言"{selected?.title}",此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}