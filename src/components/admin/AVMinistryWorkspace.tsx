import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
 * 影音播放 → 事工服侍
 * 上半：🚨 紧急广播 ｜ 下半：📝 影音记事本 (Apple Notes 风格)
 * ────────────────────────────────────────────────────────────── */

type Screen = { slug: string; name: string };
type Broadcast = {
  id: string;
  title: string;
  body: string;
  level: string;
  targets: string[];
  is_active: boolean;
  created_at: string;
  stopped_at: string | null;
};
type Note = {
  id: string;
  title: string;
  content: string;
  images: string[];
  category: string;
  is_pinned: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

const LEVELS = [
  { v: "normal", label: "普通通知", color: "bg-sky-100 text-sky-900 border-sky-300" },
  { v: "important", label: "重要通知", color: "bg-amber-100 text-amber-900 border-amber-300" },
  { v: "urgent", label: "紧急通知", color: "bg-red-100 text-red-900 border-red-300" },
];
const DEFAULT_CATEGORIES = ["影音", "投影", "直播", "TV屏幕", "宣传栏", "其他"];

const sb = supabase as any;

export function AVMinistryWorkspace() {
  return (
    <div className="space-y-6">
      <EmergencyBroadcastSection />
      <NotesSection />
    </div>
  );
}

/* ============================================================ */
/*                    紧急广播                                    */
/* ============================================================ */
function EmergencyBroadcastSection() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState("normal");
  const [targets, setTargets] = useState<string[]>(["all"]);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("display_screens").select("slug,name").order("sort_order");
      setScreens(data ?? []);
    })();
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data } = await sb
      .from("av_broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data ?? []);
  }

  const toggleTarget = (slug: string) => {
    if (slug === "all") {
      setTargets(["all"]);
      return;
    }
    setTargets((prev) => {
      const next = prev.filter((t) => t !== "all");
      return next.includes(slug) ? next.filter((t) => t !== slug) : [...next, slug];
    });
  };

  async function pushToScreens(payload: any, targetSlugs: string[]) {
    const slugs = targetSlugs.includes("all") ? screens.map((s) => s.slug) : targetSlugs;
    if (!slugs.length) return;
    // Snapshot previous content per screen so we can restore on stop.
    const { data: prev } = await sb
      .from("display_screens")
      .select("slug,current_content_type,current_content_payload,playlist_id")
      .in("slug", slugs);
    const updates = (prev ?? []).map((s: any) => {
      const restore =
        s.current_content_type === "broadcast"
          ? // already broadcasting — keep whatever restore info was saved earlier
            (s.current_content_payload?.restore ?? { type: "welcome", payload: {}, playlist_id: null })
          : {
              type: s.current_content_type,
              payload: s.current_content_payload ?? {},
              playlist_id: s.playlist_id ?? null,
            };
      return sb
        .from("display_screens")
        .update({
          current_content_type: "broadcast",
          current_content_payload: { ...payload, restore },
          updated_at: new Date().toISOString(),
        })
        .eq("slug", s.slug);
    });
    await Promise.all(updates);
  }

  async function broadcastNow() {
    if (!title.trim()) {
      toast.error("请输入广播标题");
      return;
    }
    if (!targets.length) {
      toast.error("请选择广播范围");
      return;
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), level };
      const { error } = await sb.from("av_broadcasts").insert({
        title: title.trim(),
        body: body.trim(),
        level,
        targets,
        is_active: true,
      });
      if (error) throw error;
      await pushToScreens(payload, targets);
      toast.success("已发布广播");
      setTitle("");
      setBody("");
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "广播失败");
    } finally {
      setSaving(false);
    }
  }

  async function stopBroadcast() {
    await sb
      .from("av_broadcasts")
      .update({ is_active: false, stopped_at: new Date().toISOString() })
      .eq("is_active", true);
    // Restore each broadcasting screen back to its previous content / playlist.
    const { data: live } = await sb
      .from("display_screens")
      .select("slug,current_content_payload")
      .eq("current_content_type", "broadcast");
    const restores = (live ?? []).map((s: any) => {
      const r = s.current_content_payload?.restore ?? {
        type: "welcome",
        payload: {},
        playlist_id: null,
      };
      return sb
        .from("display_screens")
        .update({
          current_content_type: r.type ?? "welcome",
          current_content_payload: r.payload ?? {},
          playlist_id: r.playlist_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", s.slug);
    });
    await Promise.all(restores);
    toast.success("已关闭广播，恢复正常播放列表");
    loadHistory();
  }

  async function clearHistory() {
    if (!confirm("确定清除所有广播历史？")) return;
    await sb.from("av_broadcasts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    loadHistory();
    toast.success("已清除");
  }

  const levelMeta = LEVELS.find((l) => l.v === level)!;

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-xl flex items-center gap-2">🚨 紧急广播</h2>
        <span className={cn("text-xs px-2 py-1 rounded-full border", levelMeta.color)}>
          {levelMeta.label}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>广播标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：欢迎主日聚会" />
        </div>
        <div className="space-y-1.5">
          <Label>广播级别（优先级）</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => <SelectItem key={l.v} value={l.v}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>广播内容</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="正文..." rows={3} />
      </div>

      <div className="space-y-1.5">
        <Label>广播范围</Label>
        <div className="flex flex-wrap gap-2">
          {[{ slug: "all", name: "所有屏幕" }, ...screens].map((s) => {
            const active = targets.includes(s.slug);
            return (
              <button
                key={s.slug}
                onClick={() => toggleTarget(s.slug)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border"
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={broadcastNow} disabled={saving}>📢 发布广播</Button>
        <Button variant="outline" onClick={stopBroadcast}>⏹ 关闭广播</Button>
        <Button variant="ghost" onClick={clearHistory}>🗑 清除历史</Button>
      </div>

      <div className="border-t border-border/50 pt-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">广播历史</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">暂无记录</p>
          )}
          {history.map((h) => {
            const lm = LEVELS.find((l) => l.v === h.level) ?? LEVELS[0];
            return (
              <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-background/50">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border whitespace-nowrap", lm.color)}>{lm.label}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{h.title}</div>
                  {h.body && <div className="text-sm text-muted-foreground line-clamp-2">{h.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(h.created_at).toLocaleString()} · {h.is_active ? "进行中" : "已结束"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*                    影音记事本                                   */
/* ============================================================ */
function NotesSection() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allCategories = useMemo(
    () => Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories])),
    [customCategories]
  );

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await sb
      .from("av_notes")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setNotes(data ?? []);
    const extra = (data ?? [])
      .map((n: Note) => n.category)
      .filter((c: string) => c && !DEFAULT_CATEGORIES.includes(c));
    setCustomCategories(Array.from(new Set(extra)));
  }

  async function createNote() {
    const { data, error } = await sb
      .from("av_notes")
      .insert({ title: "新建笔记", content: "", category: "其他" })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setNotes((p) => [data, ...p]);
    setActiveId(data.id);
  }

  async function updateNote(id: string, patch: Partial<Note>) {
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)));
    await sb.from("av_notes").update(patch).eq("id", id);
  }

  async function deleteNote(id: string) {
    if (!confirm("删除这条笔记？")) return;
    await sb.from("av_notes").delete().eq("id", id);
    setNotes((p) => p.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!activeId) {
      toast.error("请先选择或创建笔记");
      return;
    }
    const note = notes.find((n) => n.id === activeId);
    if (!note) return;
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const path = `av-notes/${activeId}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("signage").upload(path, f, { upsert: false });
      if (error) { toast.error(error.message); continue; }
      const { data } = supabase.storage.from("signage").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    if (urls.length) {
      const next = [...note.images, ...urls];
      await updateNote(activeId, { images: next });
      toast.success(`已上传 ${urls.length} 张图片`);
    }
  }

  const active = notes.find((n) => n.id === activeId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (categoryFilter === "favorite" && !n.is_favorite) return false;
      if (categoryFilter !== "all" && categoryFilter !== "favorite" && n.category !== categoryFilter) return false;
      if (!q) return true;
      return (n.title + " " + n.content).toLowerCase().includes(q);
    });
  }, [notes, search, categoryFilter]);

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-xl">📝 影音记事本</h2>
        <Button onClick={createNote} size="sm">➕ 新建笔记</Button>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { v: "all", label: "全部" },
          { v: "favorite", label: "⭐ 我的收藏" },
          ...allCategories.map((c) => ({ v: c, label: c })),
        ].map((c) => {
          const active = categoryFilter === c.v;
          return (
            <button
              key={c.v}
              onClick={() => setCategoryFilter(c.v)}
              className={cn(
                "px-3 py-1 rounded-full text-xs border transition",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
              )}
            >
              {c.label}
            </button>
          );
        })}
        <button
          onClick={() => {
            const name = prompt("新分类名称")?.trim();
            if (name && !allCategories.includes(name)) setCustomCategories((p) => [...p, name]);
          }}
          className="px-3 py-1 rounded-full text-xs border border-dashed border-border hover:bg-muted"
        >
          + 自定义
        </button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Note list */}
        <div className="space-y-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 搜索笔记..."
          />
          <div className="space-y-1.5 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">暂无笔记</p>
            )}
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setActiveId(n.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition bg-background hover:bg-muted/60",
                  activeId === n.id ? "border-primary ring-1 ring-primary/40" : "border-border/50"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {n.is_pinned && <span className="text-xs">📌</span>}
                  {n.is_favorite && <span className="text-xs">⭐</span>}
                  <span className="font-medium truncate flex-1">{n.title || "（无标题）"}</span>
                </div>
                <div className="flex gap-2">
                  {n.images[0] && (
                    <img src={n.images[0]} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="text-xs text-muted-foreground line-clamp-2 flex-1">
                    {n.content || "（无内容）"}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 flex justify-between">
                  <span>{n.category}</span>
                  <span>{new Date(n.updated_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-border/50 bg-[#fdfaf1] p-4 sm:p-5 min-h-[420px]">
          {!active ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              选择一条笔记，或点击「➕ 新建笔记」
            </div>
          ) : (
            <NoteEditor
              key={active.id}
              note={active}
              categories={allCategories}
              onChange={(patch) => updateNote(active.id, patch)}
              onDelete={() => deleteNote(active.id)}
              onUpload={(files) => uploadFiles(files)}
              onPreview={(u) => setPreviewImg(u)}
              fileInputRef={fileInputRef}
            />
          )}
        </div>
      </div>

      {/* Image preview */}
      <Dialog open={!!previewImg} onOpenChange={(o) => !o && setPreviewImg(null)}>
        <DialogContent className="max-w-5xl bg-black/90 border-none">
          <DialogHeader><DialogTitle className="text-white">图片预览</DialogTitle></DialogHeader>
          {previewImg && (
            <img src={previewImg} alt="" className="w-full max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function NoteEditor({
  note,
  categories,
  onChange,
  onDelete,
  onUpload,
  onPreview,
  fileInputRef,
}: {
  note: Note;
  categories: string[];
  onChange: (patch: Partial<Note>) => void;
  onDelete: () => void;
  onUpload: (files: FileList | File[]) => void;
  onPreview: (url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => { setTitle(note.title); setContent(note.content); }, [note.id]);

  function scheduleSave(patch: Partial<Note>) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => onChange(patch), 500);
  }

  function removeImage(url: string) {
    onChange({ images: note.images.filter((u) => u !== url) });
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onChange({ is_pinned: !note.is_pinned })}
          className={cn("text-xl", note.is_pinned ? "" : "opacity-40")}
          title="置顶"
        >📌</button>
        <button
          onClick={() => onChange({ is_favorite: !note.is_favorite })}
          className={cn("text-xl", note.is_favorite ? "" : "opacity-40")}
          title="收藏"
        >⭐</button>
        <Select value={note.category} onValueChange={(v) => onChange({ category: v })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          🖼 上传图片
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.currentTarget.value = ""; }}
        />
        <Button size="sm" variant="ghost" onClick={onDelete}>🗑 删除</Button>
      </div>

      <Input
        value={title}
        onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }); }}
        placeholder="标题"
        className="text-lg font-medium bg-transparent border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0"
      />

      <Textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); scheduleSave({ content: e.target.value }); }}
        placeholder="开始书写..."
        rows={12}
        className="bg-transparent border-0 px-0 focus-visible:ring-0 resize-none text-base"
      />

      {note.images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40">
          {note.images.map((u) => (
            <div key={u} className="relative group">
              <img
                src={u}
                alt=""
                className="w-full aspect-square object-cover rounded-lg cursor-zoom-in"
                onClick={() => onPreview(u)}
              />
              <button
                onClick={() => removeImage(u)}
                className="absolute top-1 right-1 bg-black/60 text-white text-xs w-5 h-5 rounded-full opacity-0 group-hover:opacity-100"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t border-border/40 flex justify-between">
        <span>创建：{new Date(note.created_at).toLocaleString()}</span>
        <span>修改：{new Date(note.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}