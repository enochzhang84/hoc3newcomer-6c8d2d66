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
import { Plus, Pencil, Trash2, ImagePlus, X } from "lucide-react";
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
  images?: string[];
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
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

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
  const viewing = messages.find((m) => m.id === viewerId) ?? null;

  const openCreate = () => {
    setEditingId(null);
    setDraftTitle("");
    setDraftContent("");
    setDraftImages([]);
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
    setDraftImages(selected.images ?? []);
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
          ? { ...m, title, content: draftContent, images: draftImages, updatedAt: Date.now() }
          : m,
      );
    } else {
      const newMsg: Message = {
        id: crypto.randomUUID(),
        title,
        content: draftContent,
        images: draftImages,
        updatedAt: Date.now(),
      };
      next = [newMsg, ...messages];
      setSelectedId(newMsg.id);
    }
    setMessages(next);
    try {
      saveMessages(next);
    } catch {
      toast.error("保存失败,图片可能过大,请减少图片数量或尺寸");
      return;
    }
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

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const compressImage = async (file: File, maxDim = 1600, quality = 0.8): Promise<string> => {
    const dataUrl = await readFileAsDataUrl(file);
    if (!file.type.startsWith("image/")) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      toast.error("请选择图片文件");
      return;
    }
    try {
      const results = await Promise.all(list.map((f) => compressImage(f)));
      setDraftImages((prev) => [...prev, ...results]);
    } catch {
      toast.error("图片处理失败");
    }
  };

  const removeDraftImage = (idx: number) => {
    setDraftImages((prev) => prev.filter((_, i) => i !== idx));
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
                  onDoubleClick={() => {
                    setSelectedId(m.id);
                    setViewerId(m.id);
                  }}
                  className={`cursor-pointer p-4 transition-colors hover:bg-accent/40 ${
                    active ? "border-primary ring-1 ring-primary" : ""
                  }`}
                >
                  <div className="font-medium truncate">{m.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {m.content || "(无内容)"}
                  </div>
                  {m.images && m.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.images.slice(0, 4).map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          className="h-14 w-14 rounded object-cover border"
                        />
                      ))}
                      {m.images.length > 4 && (
                        <span className="text-xs text-muted-foreground self-end">
                          +{m.images.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">
                    {new Date(m.updatedAt).toLocaleString()}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          内容保存在本浏览器,关闭页面后下次打开仍然可见。双击留言可进入浏览模式。
        </p>
      </main>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleImageFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center gap-2 px-3 h-9 rounded-md border bg-background text-sm cursor-pointer hover:bg-accent">
                    <ImagePlus className="h-4 w-4" /> 选择图片
                  </span>
                </label>
                <label className="inline-flex sm:hidden">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      handleImageFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center gap-2 px-3 h-9 rounded-md border bg-background text-sm cursor-pointer hover:bg-accent">
                    <ImagePlus className="h-4 w-4" /> 拍照
                  </span>
                </label>
                {draftImages.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    已添加 {draftImages.length} 张
                  </span>
                )}
              </div>
              {draftImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {draftImages.map((src, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={src}
                        alt=""
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => removeDraftImage(i)}
                        className="absolute top-1 right-1 bg-background/90 border rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="删除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      <Dialog open={!!viewerId} onOpenChange={(o) => !o && setViewerId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title ?? "浏览留言"}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                更新时间:{new Date(viewing.updatedAt).toLocaleString()}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {viewing.content || "(无内容)"}
              </div>
              {viewing.images && viewing.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {viewing.images.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer">
                      <img
                        src={src}
                        alt=""
                        className="w-full h-40 object-cover rounded border hover:opacity-90"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (viewing) {
                  setSelectedId(viewing.id);
                  setViewerId(null);
                  setEditingId(viewing.id);
                  setDraftTitle(viewing.title);
                  setDraftContent(viewing.content);
                  setDraftImages(viewing.images ?? []);
                  setEditorOpen(true);
                }
              }}
            >
              编辑
            </Button>
            <Button onClick={() => setViewerId(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}