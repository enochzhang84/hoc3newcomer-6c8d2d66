import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import {
  FolderIcon,
  FolderPlus,
  Pencil,
  Trash2,
  Plus,
  LayoutGrid,
  List,
  Download,
  Printer,
  Link2,
  Star,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  sort_order: number;
};

type QrItem = {
  id: string;
  name: string;
  category_id: string | null;
  target_url: string | null;
  image_url: string | null;
  description: string | null;
  is_default: boolean;
  usage_type: string | null;
  created_at: string;
  updated_at: string;
};

/** Legacy / built-in QR codes — always available, read-only, shown under 系统内置. */
function buildLegacyItems(publicBase: string, eventToken?: string | null): QrItem[] {
  const now = new Date().toISOString();
  const make = (key: string, name: string, url: string, usage_type: string): QrItem => ({
    id: `legacy:${key}`,
    name,
    category_id: null,
    target_url: url,
    image_url: null,
    description: "系统内置二维码（原有功能保留）",
    is_default: false,
    usage_type,
    created_at: now,
    updated_at: now,
  });
  return [
    make("register", "扫码登记（新人登记）",
      eventToken ? `${publicBase}/register?event=${eventToken}` : `${publicBase}/register`,
      "newcomer"),
    make("retreat", "退修会登记", `${publicBase}/retreat`, "retreat"),
    make("sunday", "成人主日学签到", `${publicBase}/sunday-checkin`, "sunday"),
    make("adult-summer", "暑期成人主日学签到", `${publicBase}/adult-checkin/summer`, "sunday"),
    make("adult-fall", "秋季成人主日学签到", `${publicBase}/adult-checkin/fall`, "sunday"),
    make("serve", "服侍申请", `${publicBase}/serve-apply`, "ministry"),
    make("fellowship", "团契 / 小组聚会签到", `${publicBase}/fellowship-checkin`, "fellowship"),
    make("feedback", "问题反馈", `${publicBase}/feedback`, "feedback"),
  ];
}

const LEGACY_CATEGORY_ID = "__legacy__";
const ALL_CATEGORY_ID = "__all__";
const UNCATEGORIZED_ID = "__uncategorized__";

type ViewMode = "icon" | "list";

/** Detect Lovable editor / iframe preview. */
function detectPreviewEnv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    // Cross-origin access throws -> we ARE in an iframe
    return true;
  }
  try {
    const h = window.location.hostname;
    if (/lovable\.app$|lovableproject\.com$|lovable\.dev$/i.test(h)) return true;
  } catch {
    /* noop */
  }
  return false;
}

const PREVIEW_INITIAL_LIMIT = 6;

export function QrLibraryManager({
  publicBase,
  eventToken,
  canEdit,
}: {
  publicBase: string;
  eventToken?: string | null;
  canEdit: boolean;
}) {
  const isPreview = useMemo(() => detectPreviewEnv(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<QrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>(ALL_CATEGORY_ID);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("icon");
  const [editingItem, setEditingItem] = useState<QrItem | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  /** In preview, only generate QR on explicit user opt-in to avoid jank. */
  const [forceRenderQr, setForceRenderQr] = useState<Set<string>>(new Set());
  const [catDialog, setCatDialog] = useState<{ mode: "create" | "rename"; cat?: Category } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onOk: () => void;
  } | null>(null);
  const askConfirm = useCallback(
    (title: string, message: string, onOk: () => void) =>
      setConfirmState({ title, message, onOk }),
    [],
  );

  const legacyItems = useMemo(() => buildLegacyItems(publicBase, eventToken), [publicBase, eventToken]);

  async function refresh() {
    setLoading(true);
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from("qr_categories").select("*").order("sort_order").order("name"),
      supabase.from("qr_library").select("*").order("updated_at", { ascending: false }),
    ]);
    if (catsRes.data) setCategories(catsRes.data as Category[]);
    if (itemsRes.data) setItems(itemsRes.data as QrItem[]);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  const allItems = useMemo(() => [...items, ...legacyItems], [items, legacyItems]);

  const filtered = useMemo(() => {
    if (selectedCat === ALL_CATEGORY_ID) return allItems;
    if (selectedCat === LEGACY_CATEGORY_ID) return legacyItems;
    if (selectedCat === UNCATEGORIZED_ID) return items.filter((i) => !i.category_id);
    return items.filter((i) => i.category_id === selectedCat);
  }, [selectedCat, items, legacyItems, allItems]);

  // In Lovable preview, cap how many cards we mount to keep things snappy.
  const visibleList = useMemo(() => {
    if (!isPreview || showAllInPreview || viewMode !== "icon") return filtered;
    return filtered.slice(0, PREVIEW_INITIAL_LIMIT);
  }, [filtered, isPreview, showAllInPreview, viewMode]);
  const hiddenCount = filtered.length - visibleList.length;

  // Reset paging when changing category/view.
  useEffect(() => { setShowAllInPreview(false); }, [selectedCat, viewMode]);

  const requestRenderQr = useCallback((id: string) => {
    setForceRenderQr((s) => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      return n;
    });
  }, []);

  const selectedItem = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return allItems.find((i) => i.id === id) ?? null;
  }, [selectedIds, allItems]);

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const multi = !!(e?.metaKey || e?.ctrlKey);
      // Plain click: select only this one; click again deselects.
      if (!multi) {
        if (prev.size === 1 && prev.has(id)) return new Set();
        return new Set([id]);
      }
      // Multi-select toggle.
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ===== Category CRUD =====
  async function saveCategory(name: string) {
    if (!name.trim()) return;
    if (catDialog?.mode === "create") {
      const max = Math.max(0, ...categories.map((c) => c.sort_order));
      const { error } = await supabase.from("qr_categories").insert({ name: name.trim(), sort_order: max + 10 });
      if (error) { toast.error(error.message); return; }
      toast.success("分类已创建");
    } else if (catDialog?.mode === "rename" && catDialog.cat) {
      const { error } = await supabase.from("qr_categories").update({ name: name.trim() }).eq("id", catDialog.cat.id);
      if (error) { toast.error(error.message); return; }
      toast.success("分类已更新");
    }
    setCatDialog(null);
    await refresh();
  }

  async function deleteCategory(cat: Category) {
    askConfirm(
      "删除分类",
      `确定删除分类「${cat.name}」？分类内的二维码不会被删除，只是变为未分类。`,
      async () => {
        const { error } = await supabase.from("qr_categories").delete().eq("id", cat.id);
        if (error) { toast.error(error.message); return; }
        if (selectedCat === cat.id) setSelectedCat(ALL_CATEGORY_ID);
        toast.success("分类已删除");
        await refresh();
      },
    );
  }

  // ===== Item ops =====
  async function deleteItem(item: QrItem) {
    if (item.id.startsWith("legacy:")) {
      toast.info("系统内置二维码不可删除");
      return;
    }
    askConfirm("删除二维码", `确定删除「${item.name}」？`, async () => {
      const { error } = await supabase.from("qr_library").delete().eq("id", item.id);
      if (error) { toast.error(error.message); return; }
      setSelectedIds((s) => { const n = new Set(s); n.delete(item.id); return n; });
      toast.success("已删除");
      await refresh();
    });
  }

  async function batchDelete() {
    const ids = Array.from(selectedIds).filter((id) => !id.startsWith("legacy:"));
    if (!ids.length) return;
    askConfirm("批量删除", `确定删除选中的 ${ids.length} 个二维码？`, async () => {
      const { error } = await supabase.from("qr_library").delete().in("id", ids);
      if (error) { toast.error(error.message); return; }
      setSelectedIds(new Set());
      toast.success("已删除");
      await refresh();
    });
  }

  async function moveToCategory(item: QrItem, categoryId: string | null) {
    if (item.id.startsWith("legacy:")) return;
    const { error } = await supabase.from("qr_library").update({ category_id: categoryId }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("已移动");
    await refresh();
  }

  async function setAsDefault(item: QrItem, slot: "qr_newcomer_url" | "qr_retreat_url" | "qr_image_url") {
    const url = item.target_url || item.image_url;
    if (!url) { toast.error("无可用链接"); return; }
    // Get latest home_page_settings row, or create one.
    const { data: existing } = await supabase.from("home_page_settings").select("id").limit(1).maybeSingle();
    const patch: Record<string, string> = { [slot]: url };
    if (existing?.id) {
      const { error } = await supabase.from("home_page_settings").update(patch as never).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("home_page_settings").insert(patch as never);
      if (error) { toast.error(error.message); return; }
    }
    if (!item.id.startsWith("legacy:")) {
      await supabase.from("qr_library").update({ is_default: true }).eq("id", item.id);
    }
    toast.success("已设为默认，网站对应位置将使用此二维码");
    await refresh();
  }

  function copyUrl(url: string | null) {
    if (!url) { toast.error("无链接"); return; }
    navigator.clipboard.writeText(url);
    toast.success("链接已复制");
  }

  function svgToCanvas(svg: SVGSVGElement, size = 600): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const data = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  async function downloadPng(item: QrItem) {
    const url = item.target_url;
    if (!url) { toast.error("无链接"); return; }
    // Render via off-DOM SVG
    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    try {
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(wrapper);
      await new Promise<void>((resolve) => {
        root.render(<QRCodeSVG value={url} size={600} level="H" includeMargin />);
        setTimeout(resolve, 50);
      });
      const svg = wrapper.querySelector("svg")!;
      const canvas = await svgToCanvas(svg, 600);
      const link = document.createElement("a");
      link.download = `${item.name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      root.unmount();
    } finally {
      wrapper.remove();
    }
  }

  function printItem(item: QrItem) {
    const url = item.target_url;
    if (!url) { toast.error("无链接"); return; }
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${item.name}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
h1{font-size:28px;margin:0 0 16px;}p.url{color:#555;margin:16px 0 0;font-size:12px;word-break:break-all;text-align:center;max-width:520px;}
p.desc{color:#333;margin:8px 0 0;font-size:14px;text-align:center;max-width:520px;}
img{width:480px;height:480px;}@media print{@page{margin:1cm;}}</style></head>
<body><h1>${item.name}</h1><img src="${qrSrc}" alt="QR"/>
${item.description ? `<p class="desc">${item.description}</p>` : ""}
<p class="url">${url}</p>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("浏览器拦截了弹窗"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  function batchPrint() {
    const list = Array.from(selectedIds).map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as QrItem[];
    list.forEach((it) => printItem(it));
  }

  async function batchDownload() {
    const list = Array.from(selectedIds).map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as QrItem[];
    for (const it of list) await downloadPng(it);
  }

  // ===== Render =====
  return (
    <div className="flex flex-col h-[70vh] border border-border/50 rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setViewMode("icon")} className={cn(viewMode === "icon" && "bg-accent")}>
            <LayoutGrid className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setViewMode("list")} className={cn(viewMode === "list" && "bg-accent")}>
            <List className="size-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {selectedIds.size > 0 ? `已选 ${selectedIds.size} 项` : `共 ${filtered.length} 项`}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={batchDownload}><Download className="size-3.5 mr-1" />批量下载</Button>
              <Button size="sm" variant="outline" onClick={batchPrint}><Printer className="size-3.5 mr-1" />批量打印</Button>
              {canEdit && (
                <Button size="sm" variant="destructive" onClick={batchDelete}><Trash2 className="size-3.5 mr-1" />批量删除</Button>
              )}
            </>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setCreatingItem(true)}><Plus className="size-3.5 mr-1" />新增二维码</Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 border-r border-border/50 bg-muted/20 overflow-y-auto">
          <div className="p-2">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">二维码库</div>
            <SidebarItem label="全部" count={allItems.length}
              active={selectedCat === ALL_CATEGORY_ID}
              onClick={() => setSelectedCat(ALL_CATEGORY_ID)} />
            <SidebarItem label="系统内置" count={legacyItems.length}
              active={selectedCat === LEGACY_CATEGORY_ID}
              onClick={() => setSelectedCat(LEGACY_CATEGORY_ID)} />
            <SidebarItem label="未分类" count={items.filter((i) => !i.category_id).length}
              active={selectedCat === UNCATEGORIZED_ID}
              onClick={() => setSelectedCat(UNCATEGORIZED_ID)} />
          </div>
          <div className="px-2 py-1 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">分类</div>
            {canEdit && (
              <button
                className="p-1 hover:bg-accent rounded"
                onClick={() => setCatDialog({ mode: "create" })}
                title="新建分类"
              >
                <FolderPlus className="size-3.5" />
              </button>
            )}
          </div>
          <div className="px-2 pb-3 space-y-0.5">
            {categories.map((c) => (
              <ContextMenu key={c.id}>
                <ContextMenuTrigger asChild>
                  <div>
                    <SidebarItem
                      icon={<FolderIcon className="size-3.5" />}
                      label={c.name}
                      count={items.filter((i) => i.category_id === c.id).length}
                      active={selectedCat === c.id}
                      onClick={() => setSelectedCat(c.id)}
                    />
                  </div>
                </ContextMenuTrigger>
                {canEdit && (
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => setCatDialog({ mode: "rename", cat: c })}>
                      <Pencil className="size-3.5 mr-2" />重命名
                    </ContextMenuItem>
                    <ContextMenuItem className="text-destructive" onClick={() => deleteCategory(c)}>
                      <Trash2 className="size-3.5 mr-2" />删除
                    </ContextMenuItem>
                  </ContextMenuContent>
                )}
              </ContextMenu>
            ))}
          </div>
        </aside>

        {/* Main list */}
        <main className="flex-1 overflow-y-auto p-3 bg-background">
          {loading ? (
            <div className="text-sm text-muted-foreground p-6">加载中…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-6 text-center">此分类暂无二维码</div>
          ) : viewMode === "icon" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {filtered.map((it) => (
                <QrCard
                  key={it.id}
                  item={it}
                  selected={selectedIds.has(it.id)}
                  onClick={(e) => toggleSelect(it.id, e)}
                  onDoubleClick={() => canEdit && !it.id.startsWith("legacy:") && setEditingItem(it)}
                  menu={
                    <ItemMenu
                      item={it}
                      categories={categories}
                      canEdit={canEdit}
                      onEdit={() => setEditingItem(it)}
                      onDelete={() => deleteItem(it)}
                      onCopy={() => copyUrl(it.target_url)}
                      onDownload={() => downloadPng(it)}
                      onPrint={() => printItem(it)}
                      onMove={(cid) => moveToCategory(it, cid)}
                      onSetDefault={(slot) => setAsDefault(it, slot)}
                    />
                  }
                />
              ))}
            </div>
          ) : (
            <ListView
              items={filtered}
              selectedIds={selectedIds}
              onSelect={(id, e) => toggleSelect(id, e)}
              renderMenu={(it) => (
                <ItemMenu
                  item={it}
                  categories={categories}
                  canEdit={canEdit}
                  onEdit={() => setEditingItem(it)}
                  onDelete={() => deleteItem(it)}
                  onCopy={() => copyUrl(it.target_url)}
                  onDownload={() => downloadPng(it)}
                  onPrint={() => printItem(it)}
                  onMove={(cid) => moveToCategory(it, cid)}
                  onSetDefault={(slot) => setAsDefault(it, slot)}
                />
              )}
            />
          )}
        </main>

        {/* Inspector */}
        <aside className="w-64 shrink-0 border-l border-border/50 bg-muted/20 overflow-y-auto p-3 text-sm">
          {selectedItem ? (
            <Inspector item={selectedItem} categoryName={categories.find((c) => c.id === selectedItem.category_id)?.name ?? "未分类"} />
          ) : (
            <div className="text-xs text-muted-foreground text-center pt-12">选择二维码以查看详情</div>
          )}
        </aside>
      </div>

      {/* Category Dialog */}
      {catDialog && (
        <CategoryDialog
          mode={catDialog.mode}
          initial={catDialog.cat?.name ?? ""}
          onSave={saveCategory}
          onClose={() => setCatDialog(null)}
        />
      )}
      {/* Item Editor */}
      {(creatingItem || editingItem) && (
        <ItemEditor
          item={editingItem}
          categories={categories}
          onClose={() => { setCreatingItem(false); setEditingItem(null); }}
          onSaved={() => { setCreatingItem(false); setEditingItem(null); void refresh(); }}
        />
      )}
      {/* Non-blocking confirm */}
      {confirmState && (
        <Dialog open onOpenChange={(o) => !o && setConfirmState(null)}>
          <DialogContent
            className="max-w-sm"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{confirmState.title}</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-foreground/80 whitespace-pre-wrap">
              {confirmState.message}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmState(null)}>取消</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const fn = confirmState.onOk;
                  setConfirmState(null);
                  fn();
                }}
              >
                确定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, count, active, onClick }: {
  icon?: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-2 py-1 rounded text-sm hover:bg-accent transition-colors",
        active && "bg-accent text-accent-foreground font-medium",
      )}
    >
      <span className="flex items-center gap-1.5 truncate">{icon}{label}</span>
      <span className="text-[10px] text-muted-foreground">{count}</span>
    </button>
  );
}

const QrThumb = memo(function QrThumb({
  imageUrl,
  targetUrl,
  size,
}: {
  imageUrl: string | null;
  targetUrl: string | null;
  size: number;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        loading="lazy"
        alt=""
        style={{ width: size, height: size }}
        className="object-contain"
      />
    );
  }
  if (targetUrl) {
    return <QRCodeSVG value={targetUrl} size={size} level="H" />;
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center text-[10px] text-muted-foreground"
    >
      无链接
    </div>
  );
});

const QrCard = memo(function QrCard({ item, selected, onClick, onDoubleClick, menu }: {
  item: QrItem;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  menu: React.ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          className={cn(
            "border rounded-lg p-2 flex flex-col items-center gap-1.5 cursor-pointer transition-colors bg-background",
            selected ? "border-primary ring-2 ring-primary/30" : "border-border/50 hover:border-border",
          )}
        >
          <div className="bg-white p-1.5 rounded">
            <QrThumb imageUrl={item.image_url} targetUrl={item.target_url} size={110} />
          </div>
          <div className="text-xs font-medium text-center truncate w-full" title={item.name}>{item.name}</div>
          {item.is_default && (
            <div className="text-[9px] text-amber-600 flex items-center gap-0.5"><Star className="size-2.5 fill-current" />默认</div>
          )}
        </div>
      </ContextMenuTrigger>
      {menu}
    </ContextMenu>
  );
});

function ListView({ items, selectedIds, onSelect, renderMenu }: {
  items: QrItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, e: React.MouseEvent) => void;
  renderMenu: (it: QrItem) => React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <div className="grid grid-cols-[1fr,120px,140px,80px] gap-2 px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
        <div>名称</div><div>类型</div><div>修改时间</div><div>状态</div>
      </div>
      {items.map((it) => (
        <ContextMenu key={it.id}>
          <ContextMenuTrigger asChild>
            <div
              onClick={(e) => onSelect(it.id, e)}
              className={cn(
                "grid grid-cols-[1fr,120px,140px,80px] gap-2 px-2 py-1.5 items-center cursor-pointer rounded",
                selectedIds.has(it.id) ? "bg-primary/10" : "hover:bg-accent/50",
              )}
            >
              <div className="truncate flex items-center gap-2">
                <QrCode className="size-4 shrink-0 text-muted-foreground" />
                {it.name}
              </div>
              <div className="text-xs text-muted-foreground truncate">{it.usage_type || "—"}</div>
              <div className="text-xs text-muted-foreground">{new Date(it.updated_at).toLocaleString()}</div>
              <div className="text-xs">{it.is_default ? "默认" : it.id.startsWith("legacy:") ? "内置" : ""}</div>
            </div>
          </ContextMenuTrigger>
          {renderMenu(it)}
        </ContextMenu>
      ))}
    </div>
  );
}

function Inspector({ item, categoryName }: { item: QrItem; categoryName: string }) {
  return (
    <div className="space-y-3">
      <div className="bg-white p-2 rounded mx-auto w-fit">
        <QrThumb imageUrl={item.image_url} targetUrl={item.target_url} size={180} />
      </div>
      <Field label="名称" value={item.name} />
      <Field label="分类" value={categoryName} />
      <Field label="类型" value={item.usage_type || "—"} />
      <Field label="目标链接" value={item.target_url || "—"} mono />
      <Field label="备注" value={item.description || "—"} />
      <Field label="创建时间" value={new Date(item.created_at).toLocaleString()} />
      <Field label="最后修改" value={new Date(item.updated_at).toLocaleString()} />
      {item.is_default && <div className="text-xs text-amber-600 flex items-center gap-1"><Star className="size-3 fill-current" />已设为默认</div>}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xs break-all", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function ItemMenu({
  item, categories, canEdit,
  onEdit, onDelete, onCopy, onDownload, onPrint, onMove, onSetDefault,
}: {
  item: QrItem;
  categories: Category[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onMove: (categoryId: string | null) => void;
  onSetDefault: (slot: "qr_newcomer_url" | "qr_retreat_url" | "qr_image_url") => void;
}) {
  const isLegacy = item.id.startsWith("legacy:");
  return (
    <ContextMenuContent className="w-56">
      <ContextMenuItem onClick={onCopy}><Link2 className="size-3.5 mr-2" />复制链接</ContextMenuItem>
      <ContextMenuItem onClick={onDownload}><Download className="size-3.5 mr-2" />下载 PNG</ContextMenuItem>
      <ContextMenuItem onClick={onPrint}><Printer className="size-3.5 mr-2" />打印</ContextMenuItem>
      <ContextMenuSeparator />
      {canEdit && (
        <ContextMenuSub>
          <ContextMenuSubTrigger><Star className="size-3.5 mr-2" />设为默认</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onSetDefault("qr_newcomer_url")}>新人登记</ContextMenuItem>
            <ContextMenuItem onClick={() => onSetDefault("qr_retreat_url")}>退修会</ContextMenuItem>
            <ContextMenuItem onClick={() => onSetDefault("qr_image_url")}>首页 / TV 屏二维码图片</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {canEdit && !isLegacy && (
        <>
          <ContextMenuItem onClick={onEdit}><Pencil className="size-3.5 mr-2" />编辑</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger><FolderIcon className="size-3.5 mr-2" />移动分类</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => onMove(null)}>未分类</ContextMenuItem>
              <ContextMenuSeparator />
              {categories.map((c) => (
                <ContextMenuItem key={c.id} onClick={() => onMove(c.id)}>{c.name}</ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="size-3.5 mr-2" />删除
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}

function CategoryDialog({ mode, initial, onSave, onClose }: {
  mode: "create" | "rename"; initial: string; onSave: (n: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建分类" : "重命名分类"}</DialogTitle>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="分类名称" autoFocus />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={() => onSave(name)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemEditor({ item, categories, onClose, onSaved }: {
  item: QrItem | null; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [targetUrl, setTargetUrl] = useState(item?.target_url ?? "");
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [usageType, setUsageType] = useState(item?.usage_type ?? "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    const path = `qr-library/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    toast.success("图片已上传");
  }

  async function save() {
    if (!name.trim()) { toast.error("请输入名称"); return; }
    if (!targetUrl.trim() && !imageUrl.trim()) { toast.error("请填写链接或上传图片"); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      category_id: categoryId,
      target_url: targetUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      usage_type: usageType.trim() || null,
    };
    const res = item
      ? await supabase.from("qr_library").update(payload).eq("id", item.id)
      : await supabase.from("qr_library").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(item ? "已更新" : "已创建");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "编辑二维码" : "新增二维码"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">名称 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：奉献二维码" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">分类</label>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">未分类</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">目标链接</label>
            <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." />
            {targetUrl && (
              <div className="mt-2 inline-block bg-white p-2 rounded">
                <QRCodeSVG value={targetUrl} size={120} level="H" />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">或上传二维码图片</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef} type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>选择图片</Button>
              {imageUrl && <img src={imageUrl} alt="" className="w-12 h-12 object-contain border rounded" />}
              {imageUrl && <Button size="sm" variant="ghost" onClick={() => setImageUrl("")}>清除</Button>}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">类型标签（可选）</label>
            <Input value={usageType} onChange={(e) => setUsageType(e.target.value)} placeholder="例如：donation, zoom, wechat" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">备注</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}