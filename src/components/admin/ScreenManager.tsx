import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Screen = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  orientation: string;
  current_content_type: string;
  current_content_payload: Record<string, unknown> | null;
  playlist_id: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  sort_order: number;
};

type Playlist = { id: string; name: string; interval_seconds: number };
type PlaylistItem = {
  id: string;
  playlist_id: string;
  sort_order: number;
  content_type: string;
  content_payload: Record<string, unknown> | null;
};

const CONTENT_TYPES: { key: string; label: string }[] = [
  { key: "welcome", label: "欢迎屏" },
  { key: "qrcode", label: "二维码" },
  { key: "worship", label: "主日崇拜" },
  { key: "retreat", label: "退修会报名" },
  { key: "meal", label: "用餐通知" },
  { key: "announcement", label: "教会公告" },
  { key: "emergency", label: "紧急广播" },
  { key: "playlist", label: "播放列表" },
];

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 60_000;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "从未";
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}小时前`;
  return `${Math.floor(sec / 86400)}天前`;
}

export function ScreenManager() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [, setTick] = useState(0);

  // Re-render every 15s to refresh "online" badge
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const [{ data: s }, { data: p }, { data: i }] = await Promise.all([
      supabase.from("display_screens" as never).select("*").order("sort_order"),
      supabase.from("display_playlists" as never).select("*").order("name"),
      supabase.from("display_playlist_items" as never).select("*").order("sort_order"),
    ]);
    setScreens((s as unknown as Screen[]) ?? []);
    setPlaylists((p as unknown as Playlist[]) ?? []);
    setItems((i as unknown as PlaylistItem[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "display_screens" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "display_playlists" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "display_playlist_items" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // ---------- screen actions ----------
  const updateScreen = async (id: string, patch: Partial<Screen>) => {
    const { error } = await supabase.from("display_screens" as never).update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("已更新");
  };

  const setContent = async (
    screen: Screen,
    type: string,
    payload: Record<string, unknown> = {},
    playlistId: string | null = null,
  ) => {
    await updateScreen(screen.id, {
      current_content_type: type,
      current_content_payload: payload,
      playlist_id: type === "playlist" ? playlistId : null,
    });
  };

  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ slug: "", name: "", location: "", orientation: "landscape" });
  const createScreen = async () => {
    if (!draft.slug || !draft.name) return toast.error("请填写 slug 和名称");
    const { error } = await supabase
      .from("display_screens" as never)
      .insert([{ ...draft, sort_order: screens.length + 1 } as never]);
    if (error) return toast.error(error.message);
    toast.success("已新增屏幕");
    setDraft({ slug: "", name: "", location: "", orientation: "landscape" });
    setShowNew(false);
  };

  const deleteScreen = async (id: string) => {
    if (!confirm("确定删除此屏幕？")) return;
    const { error } = await supabase.from("display_screens" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  // ---------- emergency broadcast ----------
  const [emergencyMsg, setEmergencyMsg] = useState("");
  const broadcastEmergency = async () => {
    if (!emergencyMsg.trim()) return toast.error("请输入紧急通知内容");
    if (!confirm(`确认向全部 ${screens.length} 块屏幕发送紧急广播？`)) return;
    const { error } = await supabase
      .from("display_screens" as never)
      .update({
        current_content_type: "emergency",
        current_content_payload: { title: "紧急通知", message: emergencyMsg },
      } as never)
      .eq("is_active", true);
    if (error) toast.error(error.message);
    else toast.success("已广播");
  };

  // ---------- announcement push ----------
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annTargets, setAnnTargets] = useState<Record<string, boolean>>({});
  const pushAnnouncement = async () => {
    const ids = Object.keys(annTargets).filter((id) => annTargets[id]);
    if (ids.length === 0) return toast.error("请选择目标屏幕");
    const { error } = await supabase
      .from("display_screens" as never)
      .update({
        current_content_type: "announcement",
        current_content_payload: { title: annTitle, message: annMessage },
      } as never)
      .in("id", ids);
    if (error) toast.error(error.message);
    else toast.success(`已推送到 ${ids.length} 块屏幕`);
  };

  // ---------- playlists ----------
  const [newPlName, setNewPlName] = useState("");
  const [newPlInterval, setNewPlInterval] = useState(10);
  const createPlaylist = async () => {
    if (!newPlName.trim()) return toast.error("请输入播放列表名称");
    const { error } = await supabase
      .from("display_playlists" as never)
      .insert([{ name: newPlName, interval_seconds: newPlInterval } as never]);
    if (error) toast.error(error.message);
    else {
      setNewPlName("");
      setNewPlInterval(10);
      toast.success("已创建播放列表");
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm("删除此播放列表？")) return;
    const { error } = await supabase.from("display_playlists" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const addPlaylistItem = async (playlistId: string, content_type: string) => {
    const cur = items.filter((it) => it.playlist_id === playlistId);
    const sort = (cur[cur.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase
      .from("display_playlist_items" as never)
      .insert([{ playlist_id: playlistId, sort_order: sort, content_type, content_payload: {} } as never]);
    if (error) toast.error(error.message);
  };

  const updatePlaylistItem = async (id: string, patch: Partial<PlaylistItem>) => {
    const { error } = await supabase.from("display_playlist_items" as never).update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deletePlaylistItem = async (id: string) => {
    const { error } = await supabase.from("display_playlist_items" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const updatePlaylist = async (id: string, patch: Partial<Playlist>) => {
    const { error } = await supabase.from("display_playlists" as never).update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-xl">TV 屏幕管理（多屏数字标牌）</h2>
          <p className="text-sm text-muted-foreground mt-1">
            访问地址：<code className="bg-muted px-1 rounded">/display/&lt;slug&gt;</code>　·　实时推送，无需刷新
          </p>
        </div>
        <Button onClick={() => setShowNew((v) => !v)}>{showNew ? "取消" : "+ 新增屏幕"}</Button>
      </div>

      {showNew && (
        <div className="grid sm:grid-cols-4 gap-3 border border-border/50 rounded-xl p-4 bg-muted/30">
          <Input
            placeholder="slug (如 tv6 / lobby-east)"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
          />
          <Input placeholder="名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input
            placeholder="位置"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.orientation}
            onChange={(e) => setDraft({ ...draft, orientation: e.target.value })}
          >
            <option value="landscape">横屏</option>
            <option value="portrait">竖屏</option>
          </select>
          <div className="sm:col-span-4">
            <Button onClick={createScreen}>创建</Button>
          </div>
        </div>
      )}

      {/* Screens grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {screens.map((s) => {
          const online = isOnline(s.last_seen_at);
          return (
            <div key={s.id} className="border border-border/50 rounded-xl p-4 flex flex-col gap-3 bg-background">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        online ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    {s.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    /{s.slug} · {s.location || "—"} · {s.orientation === "portrait" ? "竖屏" : "横屏"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {online ? "在线" : "离线"} · 最后在线 {timeAgo(s.last_seen_at)}
                  </div>
                  <div className="text-xs mt-1">
                    当前：<span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                      {CONTENT_TYPES.find((c) => c.key === s.current_content_type)?.label || s.current_content_type}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => window.open(`/display/${s.slug}`, "_blank")}>
                    打开
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteScreen(s.id)}>
                    删除
                  </Button>
                </div>
              </div>

              <ScreenContentEditor
                screen={s}
                playlists={playlists}
                onSet={(type, payload, playlistId) => setContent(s, type, payload, playlistId)}
                onSettings={(patch) => updateScreen(s.id, patch)}
              />
            </div>
          );
        })}
      </div>

      {/* Emergency broadcast */}
      <div className="border border-red-300 rounded-xl p-4 bg-red-50">
        <h3 className="font-semibold text-red-800 mb-2">🚨 紧急广播</h3>
        <Textarea
          placeholder="向所有屏幕推送紧急通知…"
          value={emergencyMsg}
          onChange={(e) => setEmergencyMsg(e.target.value)}
          rows={2}
        />
        <div className="mt-2">
          <Button variant="destructive" onClick={broadcastEmergency}>
            广播到全部屏幕
          </Button>
        </div>
      </div>

      {/* Announcement push */}
      <div className="border border-border/50 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">推送教会公告</h3>
        <Input placeholder="标题" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
        <Textarea
          placeholder="公告内容"
          rows={3}
          value={annMessage}
          onChange={(e) => setAnnMessage(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {screens.map((s) => (
            <label key={s.id} className="inline-flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={!!annTargets[s.id]}
                onChange={(e) => setAnnTargets({ ...annTargets, [s.id]: e.target.checked })}
              />
              {s.name}
            </label>
          ))}
        </div>
        <Button onClick={pushAnnouncement}>推送到选中屏幕</Button>
      </div>

      {/* Playlists */}
      <div className="border border-border/50 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold">播放列表（自动轮播）</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            className="max-w-xs"
            placeholder="新播放列表名称"
            value={newPlName}
            onChange={(e) => setNewPlName(e.target.value)}
          />
          <Input
            type="number"
            className="w-32"
            min={2}
            value={newPlInterval}
            onChange={(e) => setNewPlInterval(Number(e.target.value) || 10)}
          />
          <span className="text-sm text-muted-foreground">秒/页</span>
          <Button onClick={createPlaylist}>创建</Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {playlists.map((pl) => (
            <PlaylistCard
              key={pl.id}
              playlist={pl}
              items={items.filter((i) => i.playlist_id === pl.id)}
              onAdd={(type) => addPlaylistItem(pl.id, type)}
              onUpdateItem={updatePlaylistItem}
              onDeleteItem={deletePlaylistItem}
              onUpdate={(patch) => updatePlaylist(pl.id, patch)}
              onDelete={() => deletePlaylist(pl.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScreenContentEditor({
  screen,
  playlists,
  onSet,
  onSettings,
}: {
  screen: Screen;
  playlists: Playlist[];
  onSet: (type: string, payload: Record<string, unknown>, playlistId: string | null) => void;
  onSettings: (patch: Partial<Screen>) => void;
}) {
  const payload = screen.current_content_payload ?? {};
  const [title, setTitle] = useState((payload.title as string) ?? "");
  const [message, setMessage] = useState((payload.message as string) ?? "");
  const [url, setUrl] = useState((payload.url as string) ?? "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setTitle(((screen.current_content_payload ?? {}).title as string) ?? "");
    setMessage(((screen.current_content_payload ?? {}).message as string) ?? "");
    setUrl(((screen.current_content_payload ?? {}).url as string) ?? "");
  }, [screen.id, screen.current_content_type, screen.current_content_payload]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CONTENT_TYPES.map((c) => (
          <button
            key={c.key}
            onClick={() => {
              if (c.key === "playlist") {
                const first = playlists[0];
                if (!first) return alert("请先创建播放列表");
                onSet("playlist", {}, first.id);
              } else {
                onSet(c.key, { title, message, url }, null);
              }
            }}
            className={`text-xs px-2 py-1 rounded border transition ${
              screen.current_content_type === c.key
                ? "bg-amber-200 border-amber-400 font-semibold"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {screen.current_content_type === "playlist" && (
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm w-full"
          value={screen.playlist_id ?? ""}
          onChange={(e) => onSet("playlist", {}, e.target.value || null)}
        >
          <option value="">— 选择播放列表 —</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{p.interval_seconds}秒）
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => setEditing((v) => !v)}
        className="text-xs underline text-muted-foreground"
      >
        {editing ? "收起" : "编辑文字 / 链接 / 屏幕设置"}
      </button>
      {editing && (
        <div className="space-y-2 pt-1">
          <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="正文 / 描述"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
          <Input
            placeholder="链接（用于二维码/退修会）"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onSet(screen.current_content_type, { title, message, url }, screen.playlist_id)}
            >
              保存内容
            </Button>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={screen.orientation}
              onChange={(e) => onSettings({ orientation: e.target.value })}
            >
              <option value="landscape">横屏</option>
              <option value="portrait">竖屏</option>
            </select>
            <Input
              className="h-8"
              value={screen.name}
              onChange={(e) => onSettings({ name: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PlaylistCard({
  playlist,
  items,
  onAdd,
  onUpdateItem,
  onDeleteItem,
  onUpdate,
  onDelete,
}: {
  playlist: Playlist;
  items: PlaylistItem[];
  onAdd: (type: string) => void;
  onUpdateItem: (id: string, patch: Partial<PlaylistItem>) => void;
  onDeleteItem: (id: string) => void;
  onUpdate: (patch: Partial<Playlist>) => void;
  onDelete: () => void;
}) {
  const [addType, setAddType] = useState("welcome");
  return (
    <div className="border border-border/50 rounded-xl p-3 bg-background space-y-2">
      <div className="flex items-center gap-2">
        <Input
          className="h-8"
          value={playlist.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
        <Input
          type="number"
          className="h-8 w-20"
          value={playlist.interval_seconds}
          onChange={(e) => onUpdate({ interval_seconds: Number(e.target.value) || 10 })}
        />
        <span className="text-xs text-muted-foreground">秒</span>
        <Button size="sm" variant="ghost" onClick={onDelete}>删除</Button>
      </div>

      <div className="space-y-1">
        {items.length === 0 && <div className="text-xs text-muted-foreground">暂无页面</div>}
        {items.map((it, idx) => {
          const payload = it.content_payload ?? {};
          return (
            <div key={it.id} className="border border-border/40 rounded p-2 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono">#{idx + 1}</span>
                <select
                  className="h-7 rounded border border-input bg-background px-1 text-xs"
                  value={it.content_type}
                  onChange={(e) => onUpdateItem(it.id, { content_type: e.target.value })}
                >
                  {CONTENT_TYPES.filter((c) => c.key !== "playlist").map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="标题"
                  defaultValue={(payload.title as string) ?? ""}
                  onBlur={(e) =>
                    onUpdateItem(it.id, {
                      content_payload: { ...payload, title: e.target.value },
                    })
                  }
                />
                <button onClick={() => onDeleteItem(it.id)} className="text-red-600 text-xs">×</button>
              </div>
              <Input
                className="h-7 text-xs"
                placeholder="正文"
                defaultValue={(payload.message as string) ?? ""}
                onBlur={(e) =>
                  onUpdateItem(it.id, {
                    content_payload: { ...payload, message: e.target.value },
                  })
                }
              />
              <Input
                className="h-7 text-xs"
                placeholder="链接（二维码/退修会）"
                defaultValue={(payload.url as string) ?? ""}
                onBlur={(e) =>
                  onUpdateItem(it.id, {
                    content_payload: { ...payload, url: e.target.value },
                  })
                }
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={addType}
          onChange={(e) => setAddType(e.target.value)}
        >
          {CONTENT_TYPES.filter((c) => c.key !== "playlist").map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onAdd(addType)}>+ 添加页面</Button>
      </div>
    </div>
  );
}