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
  const [isIPad, setIsIPad] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const iPad =
      /iPad/.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
    setIsIPad(iPad);
  }, []);

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
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      // iPad Safari fallback: hide URL bar by scrolling
      window.scrollTo(0, 1);
      setIsFullscreen(true);
    } catch (e) {
      window.scrollTo(0, 1);
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    try {
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
          {!isFullscreen && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.assign("/login")}
                title="进入后台"
                className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors"
              >
                <img src={iconAdmin} alt="后台" className="h-5 w-5 object-contain" />
              </button>
              {isIPad && (
                <button
                  onClick={enterFullscreen}
                  title="全屏"
                  className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors"
                >
                  <img src={iconFullscreen} alt="全屏" className="h-5 w-5 object-contain" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 items-center max-w-5xl mx-auto">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img src={logo} alt="基督之家第三家" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="font-serif text-3xl text-foreground leading-none">基督之家</h1>
                <p className="font-serif text-xl text-foreground mt-1">第三家</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">这家就是永生神的教会</p>
            <p className="text-sm text-muted-foreground">真理的柱石和根基 (提前 3:15)</p>

            <div className="mt-8 mb-6">
              <p className="text-sm text-accent-foreground/80">今年主题</p>
              <p className="font-serif text-2xl text-foreground mt-1">信靠顺服 · 活出基督</p>
            </div>

            <div className="space-y-2 text-sm text-foreground/90 border-t border-border/40 pt-5">
              <div className="grid grid-cols-[6rem_4rem_1fr] gap-2">
                <span className="text-muted-foreground">成人主日学</span><span>中文</span><span>9:30 am</span>
                <span></span><span>英文</span><span>9:30 am</span>
                <span className="text-muted-foreground">主日崇拜</span><span>中文</span><span>11:00 am</span>
                <span></span><span>英文</span><span>11:00 am</span>
                <span className="text-muted-foreground">儿童主日学</span><span>英文</span><span>11:00 am</span>
              </div>
              <div className="grid grid-cols-[6rem_1fr] gap-2 pt-3 border-t border-border/40 mt-3">
                <span className="text-muted-foreground">教会电话</span><span>510 651-9631 / 9937</span>
                <span className="text-muted-foreground">电邮</span><span>contact@hoc3.org</span>
                <span className="text-muted-foreground">网址</span><span>hoc3.org</span>
              </div>
            </div>

            <div className="mt-6 text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground">The Home of Christ Church in Fremont</p>
              <p>4248 Solar Way, Fremont, CA 94538</p>
            </div>
          </div>

          <div className="flex flex-col items-center">
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
            {event && (
              <Link to="/register" search={{ event: event.qr_token }} className="mt-6">
                <Button size="lg" className="rounded-full px-8">立即登记</Button>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
