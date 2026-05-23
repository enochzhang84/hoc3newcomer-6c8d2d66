import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import logo from "@/assets/logo.png";
import iconAdmin from "@/assets/icon-admin.png";
import iconFullscreen from "@/assets/icon-fullscreen.png";
import iconExitFullscreen from "@/assets/icon-exit-fullscreen.png";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [event, setEvent] = useState<{ name: string; qr_token: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isIPadSafari = () => {
    if (typeof navigator === "undefined") return false;
    const touchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && touchPoints > 1);
  };

  useEffect(() => {
    supabase
      .from("events")
      .select("name, qr_token")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setEvent(data));
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enterFullscreen = async () => {
    try {
      if (isIPadSafari()) {
        document.documentElement.classList.add("ios-kiosk-mode");
        requestAnimationFrame(() => window.scrollTo({ top: 1, left: 0, behavior: "instant" as ScrollBehavior }));
        setIsFullscreen(true);
        return;
      }
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      window.scrollTo(0, 1);
      setIsFullscreen(true);
    } catch (e) {
      window.scrollTo(0, 1);
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (isIPadSafari()) {
        document.documentElement.classList.remove("ios-kiosk-mode");
        requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }));
        setIsFullscreen(false);
        return;
      }
      const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
      setIsFullscreen(false);
    } catch {
      setIsFullscreen(false);
    }
  };

  const PUBLISHED_ORIGIN = "https://hoc3newcomer.lovable.app";
  const url = event ? `${PUBLISHED_ORIGIN}/register?event=${event.qr_token}` : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <a href="/admin" className="flex items-center gap-2">
            <img src={logo} alt="基督之家第三家" className="h-10 w-10 object-contain" />
            <span className="font-serif text-xl tracking-wide text-foreground">基督之家第三家</span>
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.assign("/login")}
              title="进入后台"
              className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors"
            >
              <img src={iconAdmin} alt="后台" className="h-5 w-5 object-contain" />
            </button>
            <button
              onPointerUp={enterFullscreen}
              title="全屏"
              type="button"
              className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors"
            >
              <img src={iconFullscreen} alt="全屏" className="h-5 w-5 object-contain" />
            </button>
            <button
              onPointerUp={exitFullscreen}
              title="退出全屏"
              type="button"
              className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors"
            >
              <img src={iconExitFullscreen} alt="退出全屏" className="h-5 w-5 object-contain" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 items-center max-w-5xl mx-auto">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-4">Welcome Home</p>
            <h1 className="font-serif text-5xl md:text-6xl leading-tight text-foreground mb-6">
              欢迎来到<br />我们中间
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              扫描下方二维码,或点击按钮完成登记。
              我们想认识您,并与您一同走信仰的旅程。
            </p>
            <div className="flex gap-3">
              {event && (
                <Link to="/register" search={{ event: event.qr_token }}>
                  <Button size="lg" className="rounded-full px-8">立即登记</Button>
                </Link>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-card p-8 rounded-2xl shadow-xl border border-border/40">
              {url ? (
                <>
                  <QRCodeSVG value={url} size={240} level="H" />
                  <p className="text-center mt-4 text-sm text-muted-foreground">
                    扫码登记 · {event?.name}
                  </p>
                </>
              ) : (
                <div className="w-60 h-60 animate-pulse bg-muted rounded" />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
