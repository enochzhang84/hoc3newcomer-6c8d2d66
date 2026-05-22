import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [event, setEvent] = useState<{ name: string; qr_token: string } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    supabase
      .from("events")
      .select("name, qr_token")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setEvent(data));
  }, []);

  const url = event ? `${origin}/register?event=${event.qr_token}` : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg">✝</div>
            <span className="font-serif text-xl tracking-wide text-foreground">恩典教会</span>
          </div>
          <Link to="/admin">
            <Button variant="ghost" size="sm">管理后台</Button>
          </Link>
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
