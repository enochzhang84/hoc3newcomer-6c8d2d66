import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeSVG } from "qrcode.react";
import { useWin98Dialog } from "./Win98Dialog";
import logoDefault from "@/assets/logo.png";

type Settings = {
  id: string;
  logo_url: string | null;
  logo_title: string | null;
  logo_subtitle: string | null;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  welcome_description: string | null;
  welcome_image_url: string | null;
  welcome_mode: string | null; // 'text' | 'image' | 'html'
  welcome_content_html: string | null;
  qr_title: string | null;
  qr_description: string | null;
  qr_image_url: string | null;
  qr_newcomer_url: string | null;
  qr_retreat_url: string | null;
};

const BUCKET = "site-assets";

function publicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // append cache-buster so newly uploaded image refreshes
  return `${data.publicUrl}?t=${Date.now()}`;
}

export function HomePageSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<Settings | null>(null);
  const { alert, confirm, dialog } = useWin98Dialog();

  // QR generator state
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [qrType, setQrType] = useState<"newcomer" | "retreat" | "custom">("newcomer");
  const [qrCustom, setQrCustom] = useState("");
  const qrSvgRef = useRef<HTMLDivElement>(null);

  const qrValue =
    qrType === "newcomer"
      ? `${origin}/register`
      : qrType === "retreat"
      ? `${origin}/retreat-register`
      : qrCustom || `${origin}/`;

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("home_page_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) alert("加载失败", error.message, "error");
      setS(data ?? null);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Settings>) => setS((cur) => (cur ? { ...cur, ...patch } : cur));

  async function uploadFile(file: File, fileName: string): Promise<string | null> {
    const path = `home/${fileName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      alert("上传失败", error.message, "error");
      return null;
    }
    return publicUrl(path);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("home_page_settings")
      .update({
        logo_url: s.logo_url,
        logo_title: s.logo_title,
        logo_subtitle: s.logo_subtitle,
        welcome_title: s.welcome_title,
        welcome_subtitle: s.welcome_subtitle,
        welcome_description: s.welcome_description,
        welcome_image_url: s.welcome_image_url,
        welcome_mode: s.welcome_mode || "text",
        welcome_content_html: s.welcome_content_html,
        qr_title: s.qr_title,
        qr_description: s.qr_description,
        qr_image_url: s.qr_image_url,
        qr_newcomer_url: s.qr_newcomer_url,
        qr_retreat_url: s.qr_retreat_url,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) alert("保存失败", error.message, "error");
    else alert("保存成功", "全部设置已保存。", "success");
  }

  // ---- QR helpers ----
  function getQrSvgString(): string | null {
    const svg = qrSvgRef.current?.querySelector("svg");
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  }

  async function qrSvgToPngBlob(size = 512): Promise<Blob | null> {
    const svgStr = getQrSvgString();
    if (!svgStr) return null;
    return new Promise((resolve) => {
      const img = new Image();
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b), "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  async function downloadPng() {
    const blob = await qrSvgToPngBlob(640);
    if (!blob) return alert("下载失败", "无法生成二维码图片。", "error");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${qrType}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(qrValue);
      alert("已复制", qrValue, "success");
    } catch {
      alert("复制失败", "浏览器不支持自动复制，请手动复制。", "error");
    }
  }

  function printQr() {
    const svgStr = getQrSvgString();
    if (!svgStr) return;
    const w = window.open("", "_blank", "width=480,height=560");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>打印二维码</title></head>
      <body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div>${svgStr}</div>
        <p style="margin-top:16px;font-size:14px;color:#333;">${qrValue}</p>
        <script>window.onload=()=>{setTimeout(()=>window.print(),200);}</script>
      </body></html>`);
    w.document.close();
  }

  async function uploadQrAsPng(name: string): Promise<string | null> {
    const blob = await qrSvgToPngBlob(640);
    if (!blob) return null;
    const file = new File([blob], `${name}.png`, { type: "image/png" });
    return uploadFile(file, `${name}.png`);
  }

  async function saveQr() {
    const url = await uploadQrAsPng(`qr-${qrType}`);
    if (!url) return alert("保存失败", "二维码上传失败。", "error");
    if (qrType === "newcomer") update({ qr_newcomer_url: url });
    else if (qrType === "retreat") update({ qr_retreat_url: url });
    alert("已保存", "二维码图片已上传，记得点击底部「保存全部设置」持久化。", "success");
  }

  function replaceSiteQr(scope: "newcomer" | "retreat" | "all") {
    confirm("确认替换", `将使用当前生成的二维码替换：${scope === "all" ? "全部二维码" : scope === "newcomer" ? "新人登记二维码" : "退修会二维码"}。继续？`, async () => {
      const url = await uploadQrAsPng(`qr-${scope === "all" ? qrType : scope}`);
      if (!url) return alert("替换失败", "二维码上传失败。", "error");
      const patch: Partial<Settings> = {};
      if (scope === "newcomer" || scope === "all") patch.qr_newcomer_url = url;
      if (scope === "retreat" || scope === "all") patch.qr_retreat_url = url;
      if (scope === "all") patch.qr_image_url = url;
      update(patch);
      alert("替换成功", "请点击底部「保存全部设置」持久化。", "success");
    }, "warn");
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中…</div>;
  }
  if (!s) {
    return <div className="text-sm text-destructive">未找到主页设置记录</div>;
  }

  return (
    <div className="space-y-6">
      {dialog}
      {/* Logo */}
      <section className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
        <h3 className="font-serif text-lg">Logo 设置</h3>
        <div className="flex items-center gap-4">
          <img
            src={s.logo_url || logoDefault}
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = logoDefault)}
            alt="Logo 预览"
            className="h-16 w-16 object-contain rounded-md border border-border/40 bg-muted/30"
          />
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await uploadFile(f, `logo.${f.name.split(".").pop() || "png"}`);
                  if (url) update({ logo_url: url });
                }}
              />
              <span className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
                上传 Logo
              </span>
            </label>
            <Button variant="outline" size="sm" onClick={() => update({ logo_url: null })}>
              恢复默认 Logo
            </Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <div className="space-y-1">
            <Label>Logo 主标题 (logo_title)</Label>
            <Input
              value={s.logo_title ?? ""}
              onChange={(e) => update({ logo_title: e.target.value })}
              placeholder="例如：基督三家事工中心"
            />
          </div>
          <div className="space-y-1">
            <Label>Logo 副标题 (logo_subtitle)</Label>
            <Input
              value={s.logo_subtitle ?? ""}
              onChange={(e) => update({ logo_subtitle: e.target.value })}
              placeholder="例如：HOC3 Ministry Center"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">用于扫码页 / 后台左上角文字显示。</p>
      </section>

      {/* Welcome */}
      <section className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
        <h3 className="font-serif text-lg">左侧欢迎区设置</h3>
        <div className="space-y-1">
          <Label>显示模式 (welcome_mode)</Label>
          <div className="flex gap-2">
            {(["text", "image", "html"] as const).map((m) => (
              <button
                key={m}
                onClick={() => update({ welcome_mode: m })}
                className={`px-3 h-9 rounded-md border text-sm ${
                  (s.welcome_mode || "text") === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input hover:bg-accent"
                }`}
              >
                {m === "text" ? "文字模式" : m === "image" ? "图片模式" : "HTML 模式"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>欢迎标题</Label>
            <Input
              value={s.welcome_title ?? ""}
              onChange={(e) => update({ welcome_title: e.target.value })}
              placeholder="例如：基督三家欢迎你"
            />
          </div>
          <div className="space-y-1">
            <Label>欢迎副标题</Label>
            <Input
              value={s.welcome_subtitle ?? ""}
              onChange={(e) => update({ welcome_subtitle: e.target.value })}
              placeholder="例如：The Home of Christ Church"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>欢迎说明文字</Label>
          <Textarea
            value={s.welcome_description ?? ""}
            onChange={(e) => update({ welcome_description: e.target.value })}
            placeholder="自由介绍文字…"
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <Label>自定义 HTML 内容 (welcome_content_html)</Label>
          <Textarea
            value={s.welcome_content_html ?? ""}
            onChange={(e) => update({ welcome_content_html: e.target.value })}
            placeholder="<div>支持任意 HTML，仅在「HTML 模式」下渲染</div>"
            rows={5}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>左侧背景图</Label>
          <div className="flex items-center gap-4">
            {s.welcome_image_url ? (
              <img
                src={s.welcome_image_url}
                alt="背景图预览"
                className="h-24 w-40 object-cover rounded-md border border-border/40"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.3")}
              />
            ) : (
              <div className="h-24 w-40 rounded-md border border-dashed border-border/60 grid place-items-center text-xs text-muted-foreground">
                未设置
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadFile(f, `welcome.${f.name.split(".").pop() || "jpg"}`);
                    if (url) update({ welcome_image_url: url });
                  }}
                />
                <span className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
                  上传背景图
                </span>
              </label>
              <Button variant="outline" size="sm" onClick={() => update({ welcome_image_url: null })}>
                清除背景图
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* QR Generator */}
      <section className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
        <h3 className="font-serif text-lg">二维码生成器</h3>
        <p className="text-xs text-muted-foreground">
          自动使用当前站点地址 <code className="px-1 bg-muted rounded">{origin}</code> 生成二维码。
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { k: "newcomer", label: "新人扫码登记", url: `${origin}/register` },
              { k: "retreat", label: "退修会报名", url: `${origin}/retreat-register` },
              { k: "custom", label: "自定义链接", url: "自定义" },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setQrType(t.k)}
              className={`px-3 h-9 rounded-md border text-sm ${
                qrType === t.k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {qrType === "custom" && (
          <Input
            value={qrCustom}
            onChange={(e) => setQrCustom(e.target.value)}
            placeholder="https://..."
          />
        )}
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div ref={qrSvgRef} className="bg-white p-3 rounded-md border border-border/40">
            <QRCodeSVG value={qrValue} size={200} level="H" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="text-xs break-all bg-muted/40 rounded px-2 py-1">{qrValue}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyLink}>复制链接</Button>
              <Button size="sm" variant="outline" onClick={downloadPng}>下载 PNG</Button>
              <Button size="sm" variant="outline" onClick={printQr}>打印二维码</Button>
              <Button size="sm" onClick={saveQr}>保存二维码</Button>
            </div>
            <div className="pt-3 border-t border-border/40 mt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">一键替换网站内二维码</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => replaceSiteQr("newcomer")}>
                  替换新人登记二维码
                </Button>
                <Button size="sm" variant="secondary" onClick={() => replaceSiteQr("retreat")}>
                  替换退修会二维码
                </Button>
                <Button size="sm" variant="destructive" onClick={() => replaceSiteQr("all")}>
                  替换全部二维码
                </Button>
              </div>
            </div>
            {(s.qr_newcomer_url || s.qr_retreat_url) && (
              <div className="grid grid-cols-2 gap-3 pt-3">
                {s.qr_newcomer_url && (
                  <div className="text-center">
                    <img src={s.qr_newcomer_url} alt="新人二维码" className="h-24 w-24 mx-auto object-contain border border-border/40 rounded" />
                    <div className="text-[10px] mt-1 text-muted-foreground">当前新人二维码</div>
                  </div>
                )}
                {s.qr_retreat_url && (
                  <div className="text-center">
                    <img src={s.qr_retreat_url} alt="退修会二维码" className="h-24 w-24 mx-auto object-contain border border-border/40 rounded" />
                    <div className="text-[10px] mt-1 text-muted-foreground">当前退修会二维码</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* QR */}
      <section className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
        <h3 className="font-serif text-lg">右侧二维码区设置</h3>
        <p className="text-xs text-muted-foreground">
          二维码图片仅用于展示。实际登记链接仍由活动二维码自动生成，不受这里影响。
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>二维码标题</Label>
            <Input
              value={s.qr_title ?? ""}
              onChange={(e) => update({ qr_title: e.target.value })}
              placeholder="例如：新人登记"
            />
          </div>
          <div className="space-y-1">
            <Label>二维码说明</Label>
            <Input
              value={s.qr_description ?? ""}
              onChange={(e) => update({ qr_description: e.target.value })}
              placeholder="例如：扫码填写新人资料"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {s.qr_image_url ? (
            <img
              src={s.qr_image_url}
              alt="二维码预览"
              className="h-28 w-28 object-contain rounded-md border border-border/40 bg-white"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.3")}
            />
          ) : (
            <div className="h-28 w-28 rounded-md border border-dashed border-border/60 grid place-items-center text-xs text-muted-foreground">
              使用动态二维码
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await uploadFile(f, `qrcode.${f.name.split(".").pop() || "png"}`);
                  if (url) update({ qr_image_url: url });
                }}
              />
              <span className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
                上传二维码
              </span>
            </label>
            <Button variant="outline" size="sm" onClick={() => update({ qr_image_url: null })}>
              恢复默认二维码
            </Button>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2 sticky bottom-2">
        <Button onClick={save} disabled={saving} className="rounded-full px-6">
          {saving ? "保存中…" : "保存全部设置"}
        </Button>
      </div>
    </div>
  );
}