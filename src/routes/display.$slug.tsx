import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/display/$slug")({
  component: DisplayScreen,
});

type Screen = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  orientation: "landscape" | "portrait" | string;
  current_content_type: string;
  current_content_payload: Record<string, unknown> | null;
  playlist_id: string | null;
  is_active: boolean;
};

type PlaylistItem = {
  id: string;
  sort_order: number;
  content_type: string;
  content_payload: Record<string, unknown> | null;
};

type Playlist = {
  id: string;
  name: string;
  interval_seconds: number;
};

function DisplayScreen() {
  const { slug } = Route.useParams();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [notFound, setNotFound] = useState(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("display_screens" as never)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        return;
      }
      setScreen(data as Screen);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Realtime subscribe to screen row
  useEffect(() => {
    if (!screen?.id) return;
    const ch = supabase
      .channel(`display-screen-${screen.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "display_screens", filter: `id=eq.${screen.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setNotFound(true);
          } else if (payload.new) {
            setScreen(payload.new as Screen);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [screen?.id]);

  // Load playlist + items when applicable
  useEffect(() => {
    if (!screen) return;
    const pid = screen.current_content_type === "playlist" ? screen.playlist_id : null;
    if (!pid) {
      setPlaylist(null);
      setItems([]);
      setPageIdx(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: pl }, { data: it }] = await Promise.all([
        supabase.from("display_playlists" as never).select("*").eq("id", pid).maybeSingle(),
        supabase
          .from("display_playlist_items" as never)
          .select("*")
          .eq("playlist_id", pid)
          .order("sort_order", { ascending: true }),
      ]);
      if (cancelled) return;
      setPlaylist((pl as unknown as Playlist) ?? null);
      setItems((it as PlaylistItem[]) ?? []);
      setPageIdx(0);
    })();

    const ch = supabase
      .channel(`display-playlist-${pid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "display_playlists", filter: `id=eq.${pid}` },
        (payload) => {
          if (payload.new) setPlaylist(payload.new as Playlist);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "display_playlist_items", filter: `playlist_id=eq.${pid}` },
        async () => {
          const { data: it } = await supabase
            .from("display_playlist_items" as never)
            .select("*")
            .eq("playlist_id", pid)
            .order("sort_order", { ascending: true });
          setItems((it as PlaylistItem[]) ?? []);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [screen?.current_content_type, screen?.playlist_id, screen]);

  // Rotate playlist
  useEffect(() => {
    if (screen?.current_content_type !== "playlist") return;
    if (items.length <= 1) return;
    const ms = Math.max(2, playlist?.interval_seconds ?? 10) * 1000;
    const t = setInterval(() => setPageIdx((i) => (i + 1) % items.length), ms);
    return () => clearInterval(t);
  }, [screen?.current_content_type, items.length, playlist?.interval_seconds]);

  // Heartbeat
  useEffect(() => {
    if (!screen?.slug) return;
    const ping = () => {
      void supabase.rpc("touch_display_screen" as never, { _slug: screen.slug } as never);
    };
    ping();
    const t = setInterval(ping, 20_000);
    return () => clearInterval(t);
  }, [screen?.slug]);

  // Hide page chrome / scrollbars
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (notFound) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center text-3xl">
        屏幕未注册：{slug}
      </div>
    );
  }
  if (!screen) {
    return (
      <div className="fixed inset-0 bg-[#FAF3E3] flex items-center justify-center text-2xl text-stone-700">
        正在加载…
      </div>
    );
  }

  const isPortrait = screen.orientation === "portrait";
  let contentType = screen.current_content_type;
  let payload: Record<string, unknown> = screen.current_content_payload ?? {};
  if (contentType === "playlist" && items.length > 0) {
    const cur = items[pageIdx % items.length];
    contentType = cur.content_type;
    payload = cur.content_payload ?? {};
  }

  return (
    <div
      className={`fixed inset-0 ${
        contentType === "emergency" ? "bg-red-700 text-white" : "bg-[#FAF3E3] text-stone-900"
      } flex flex-col`}
      style={{ writingMode: isPortrait ? undefined : undefined }}
    >
      <ContentRenderer type={contentType} payload={payload} screen={screen} portrait={isPortrait} />
      <div className="absolute bottom-3 right-4 text-xs opacity-50">
        {screen.name} · {screen.location ?? ""} · /{screen.slug}
      </div>
    </div>
  );
}

function ContentRenderer({
  type,
  payload,
  screen,
  portrait,
}: {
  type: string;
  payload: Record<string, unknown>;
  screen: Screen;
  portrait: boolean;
}) {
  const title = (payload.title as string) || "";
  const message = (payload.message as string) || "";
  const url = (payload.url as string) || "";

  const headingSize = portrait ? "text-7xl" : "text-8xl";
  const subSize = portrait ? "text-3xl" : "text-4xl";

  switch (type) {
    case "welcome":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-8">
          <div className={`${headingSize} font-serif font-bold`}>
            {title || "欢迎来到教会"}
          </div>
          <div className={`${subSize} opacity-80 max-w-5xl`}>
            {message || "Welcome — 愿主的平安与你同在"}
          </div>
        </div>
      );
    case "qrcode":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-8">
          <div className={`${headingSize} font-serif`}>{title || "扫码"}</div>
          {url ? (
            <div className="bg-white p-6 rounded-2xl">
              <QRCodeSVG value={url} size={portrait ? 480 : 560} />
            </div>
          ) : (
            <div className={subSize}>请在后台设置二维码地址</div>
          )}
          {message && <div className={`${subSize} opacity-80 max-w-4xl`}>{message}</div>}
        </div>
      );
    case "worship":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
          <div className={`${headingSize} font-serif font-bold`}>{title || "主日崇拜"}</div>
          <div className={`${subSize} opacity-80 whitespace-pre-line max-w-5xl`}>
            {message || "诗歌敬拜 · 证道 · 圣餐"}
          </div>
        </div>
      );
    case "retreat":
      return (
        <div className="flex-1 flex items-center justify-center px-12">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="bg-white p-6 rounded-2xl">
              <QRCodeSVG value={url || `${typeof window !== "undefined" ? window.location.origin : ""}/retreat-register`} size={portrait ? 380 : 460} />
            </div>
            <div className="text-left">
              <div className={`${headingSize} font-serif font-bold mb-4`}>{title || "退修会报名"}</div>
              <div className={`${subSize} opacity-80 whitespace-pre-line max-w-2xl`}>
                {message || "扫码立即报名"}
              </div>
            </div>
          </div>
        </div>
      );
    case "meal":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
          <div className={`${headingSize} font-serif font-bold`}>{title || "今日用餐通知"}</div>
          <div className={`${subSize} opacity-80 whitespace-pre-line max-w-5xl`}>{message}</div>
        </div>
      );
    case "announcement":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
          <div className={`${headingSize} font-serif font-bold`}>{title || "教会公告"}</div>
          <div className={`${subSize} opacity-80 whitespace-pre-line max-w-5xl`}>{message}</div>
        </div>
      );
    case "emergency":
      return (
        <EmergencyBlink>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
            <div className={`${headingSize} font-serif font-extrabold`}>⚠ {title || "紧急通知"}</div>
            <div className={`${subSize} whitespace-pre-line max-w-5xl`}>{message}</div>
          </div>
        </EmergencyBlink>
      );
    default:
      return (
        <div className="flex-1 flex items-center justify-center text-3xl opacity-60">
          未知内容类型：{type}
        </div>
      );
  }
}

function EmergencyBlink({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 800);
    return () => clearInterval(t);
  }, []);
  return <div className={on ? "opacity-100" : "opacity-70"}>{children}</div>;
}