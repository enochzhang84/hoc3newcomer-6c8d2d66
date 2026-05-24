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
import churchInfo from "@/assets/church-info.png";

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
      // On iPad Safari, requestFullscreen shows a persistent X button overlay.
      // Skip the native API on iPad and just hide the UI via scroll + state.
      if (!isIPad) {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
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
          {!isFullscreen ? (
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
          ) : (
            <button
              onClick={exitFullscreen}
              title="退出全屏"
              className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors opacity-40 hover:opacity-100"
            >
              <img src={iconExitFullscreen} alt="退出全屏" className="h-5 w-5 object-contain" />
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 items-center max-w-5xl mx-auto">
          <div className="flex justify-center -mt-[5px]">
            <img
              src={churchInfo}
              alt="基督之家第三家 教会信息"
              className="w-full max-w-sm object-contain mix-blend-multiply"
              style={{ background: "transparent" }}
            />
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
