import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Radio,
  Play,
  Maximize2,
  RefreshCw,
  Trash2,
  Youtube,
  CircleDot,
  Wifi,
  Clock,
  Activity,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type HistoryItem = {
  videoId: string;
  url: string;
  title: string;
  loadedAt: string; // ISO
};

const LS_URL = "admin_youtube_live_url";
const LS_HISTORY = "admin_youtube_live_history";
const LS_AUTO_REFRESH = "admin_youtube_live_autorefresh";

function extractVideoId(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.replace(/^\//, "").split("/")[0] || "";
    if (host.endsWith("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v") || "";
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "live" || p === "embed" || p === "shorts");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    return "";
  } catch {
    const m = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : "";
  }
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_HISTORY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(arr) ? arr.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_HISTORY, JSON.stringify(items.slice(0, 10)));
}

function StatPill({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="flex items-center gap-3 bg-background/60 border border-border/60 rounded-xl px-4 py-3">
      <div className={cn("shrink-0", toneClass)}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
        <div className={cn("text-sm font-medium truncate mt-0.5", toneClass)}>{value}</div>
      </div>
    </div>
  );
}

export default function LiveStreamMonitor() {
  const [urlInput, setUrlInput] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(LS_URL) || "",
  );
  const [url, setUrl] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(LS_URL) || "",
  );
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(LS_AUTO_REFRESH) === "1";
  });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(url ? new Date() : null);
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const videoId = useMemo(() => extractVideoId(url), [url]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh || !videoId) return;
    const id = window.setInterval(() => {
      if (iframeRef.current) {
        // eslint-disable-next-line no-self-assign
        iframeRef.current.src = iframeRef.current.src;
        setLastRefresh(new Date());
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, videoId]);

  const persistUrl = (v: string) => {
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem(LS_URL, v);
      else window.localStorage.removeItem(LS_URL);
    }
  };

  const handleLoad = () => {
    const v = urlInput.trim();
    setUrl(v);
    persistUrl(v);
    if (v) {
      const vid = extractVideoId(v);
      setLastRefresh(new Date());
      if (vid) {
        const item: HistoryItem = {
          videoId: vid,
          url: v,
          title: "主日崇拜直播",
          loadedAt: new Date().toISOString(),
        };
        const next = [item, ...history.filter((h) => h.videoId !== vid)].slice(0, 10);
        setHistory(next);
        saveHistory(next);
      }
      toast.success("已加载直播地址");
    } else {
      toast.message("已清空地址");
    }
  };

  const handleFullscreen = () => {
    const el = iframeRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
    else toast.error("当前浏览器不支持全屏");
  };

  const handleRefresh = () => {
    const el = iframeRef.current;
    if (el) {
      // eslint-disable-next-line no-self-assign
      el.src = el.src;
      setLastRefresh(new Date());
      toast.success("画面已刷新");
    }
  };

  const handleClear = () => {
    setUrlInput("");
    setUrl("");
    persistUrl("");
    setLastRefresh(null);
    toast.message("已清空地址");
  };

  const toggleAuto = () => {
    const next = !autoRefresh;
    setAutoRefresh(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_AUTO_REFRESH, next ? "1" : "0");
    }
  };

  const isLive = !!videoId;

  return (
    <div className="space-y-6">
      {/* 顶部标题 */}
      <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-serif text-2xl flex items-center gap-2">
              <Radio className="text-primary" />
              聚会直播监控中心
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              监控当前 YouTube 主日直播状态
            </p>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
              isLive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-muted text-muted-foreground border-border",
            )}
          >
            <CircleDot className={cn("size-3", isLive && "animate-pulse")} />
            {isLive ? "正在直播" : "未加载直播"}
          </div>
        </div>
      </section>

      {/* 第一行：直播信息 */}
      <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-medium text-foreground/80 mb-4">直播信息</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatPill
            icon={<Play className="size-5" />}
            label="直播标题"
            value="主日崇拜直播"
          />
          <StatPill
            icon={<CircleDot className="size-5" />}
            label="直播状态"
            value={isLive ? "正在直播" : "未加载"}
            tone={isLive ? "ok" : "warn"}
          />
          <StatPill
            icon={<Youtube className="size-5" />}
            label="直播平台"
            value="YouTube"
          />
          <StatPill
            icon={<Clock className="size-5" />}
            label="加载时间"
            value={lastRefresh ? format(lastRefresh, "yyyy-MM-dd HH:mm") : "—"}
          />
        </div>
        <div className="mt-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">
            直播地址
          </label>
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="粘贴 YouTube 直播或视频地址（支持 watch?v=、youtu.be、/live/、/embed/）"
            className="bg-background/60"
          />
          {url && (
            <p className="text-xs text-muted-foreground mt-2 break-all">
              当前保存：<span className="text-foreground/80">{url}</span>
            </p>
          )}
        </div>
      </section>

      {/* 第二行：操作按钮 */}
      <section className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button onClick={handleLoad} className="h-11 gap-2">
            <Play className="size-4" />
            加载直播
          </Button>
          <Button
            variant="outline"
            onClick={handleFullscreen}
            disabled={!isLive}
            className="h-11 gap-2"
          >
            <Maximize2 className="size-4" />
            全屏查看
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={!isLive}
            className="h-11 gap-2"
          >
            <RefreshCw className="size-4" />
            刷新画面
          </Button>
          <Button
            variant="ghost"
            onClick={handleClear}
            className="h-11 gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
            清空地址
          </Button>
        </div>
      </section>

      {/* 第三行：直播画面 */}
      <section className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground/80">当前直播画面</h3>
          {isLive && (
            <span className="text-[11px] text-muted-foreground font-mono">
              ID · {videoId}
            </span>
          )}
        </div>
        {isLive ? (
          <div className="bg-black">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                ref={iframeRef}
                id="yt-live-iframe"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title="YouTube 直播监视器"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground bg-background/40">
            <Youtube className="size-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">请粘贴 YouTube 直播地址，开始监看聚会直播</p>
          </div>
        )}
      </section>

      {/* 第四行：状态栏 */}
      <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-medium text-foreground/80 mb-4">系统状态</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatPill
            icon={<Activity className="size-5" />}
            label="画面状态"
            value={isLive ? "正常" : "未加载"}
            tone={isLive ? "ok" : "warn"}
          />
          <StatPill
            icon={<Wifi className="size-5" />}
            label="网络状态"
            value={online ? "已连接" : "已断开"}
            tone={online ? "ok" : "warn"}
          />
          <StatPill
            icon={<Clock className="size-5" />}
            label="最后刷新"
            value={lastRefresh ? format(lastRefresh, "HH:mm:ss") : "—"}
          />
          <button
            type="button"
            onClick={toggleAuto}
            className={cn(
              "flex items-center gap-3 border rounded-xl px-4 py-3 text-left transition-colors",
              autoRefresh
                ? "bg-emerald-50 border-emerald-200"
                : "bg-background/60 border-border/60 hover:bg-muted/40",
            )}
          >
            <RefreshCw
              className={cn(
                "size-5 shrink-0",
                autoRefresh ? "text-emerald-600 animate-spin-slow" : "text-muted-foreground",
              )}
            />
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground leading-tight">
                自动刷新（每分钟）
              </div>
              <div
                className={cn(
                  "text-sm font-medium mt-0.5",
                  autoRefresh ? "text-emerald-700" : "text-foreground",
                )}
              >
                {autoRefresh ? "开启" : "关闭"}
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* 第五行：最近记录 */}
      <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground/80 flex items-center gap-2">
            <History className="size-4" />
            最近直播记录
          </h3>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                saveHistory([]);
                toast.message("已清空历史记录");
              }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              清空记录
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            暂无直播记录
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">日期</th>
                  <th className="text-left px-4 py-2 font-medium">标题</th>
                  <th className="text-left px-4 py-2 font-medium">视频 ID</th>
                  <th className="text-left px-4 py-2 font-medium">状态</th>
                  <th className="text-right px-4 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.slice(0, 5).map((h) => {
                  const active = h.videoId === videoId;
                  return (
                    <tr key={h.videoId + h.loadedAt} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-foreground/80 whitespace-nowrap">
                        {format(new Date(h.loadedAt), "yyyy-MM-dd HH:mm")}
                      </td>
                      <td className="px-4 py-2.5">{h.title}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {h.videoId}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs",
                            active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <CircleDot className="size-2.5" />
                          {active ? "播放中" : "成功"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setUrlInput(h.url);
                            setUrl(h.url);
                            persistUrl(h.url);
                            setLastRefresh(new Date());
                            toast.success("已重新加载");
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          重新加载
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}