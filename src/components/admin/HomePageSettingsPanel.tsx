import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import logoDefault from "@/assets/logo.png";

type Settings = {
  id: string;
  logo_url: string | null;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  welcome_description: string | null;
  welcome_image_url: string | null;
  qr_title: string | null;
  qr_description: string | null;
  qr_image_url: string | null;
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

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("home_page_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) toast.error(`加载失败：${error.message}`);
      setS(data ?? null);
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<Settings>) => setS((cur) => (cur ? { ...cur, ...patch } : cur));

  async function uploadFile(file: File, fileName: string): Promise<string | null> {
    const path = `home/${fileName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error(`上传失败：${error.message}`);
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
        welcome_title: s.welcome_title,
        welcome_subtitle: s.welcome_subtitle,
        welcome_description: s.welcome_description,
        welcome_image_url: s.welcome_image_url,
        qr_title: s.qr_title,
        qr_description: s.qr_description,
        qr_image_url: s.qr_image_url,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) toast.error(`保存失败：${error.message}`);
    else toast.success("已保存");
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中…</div>;
  }
  if (!s) {
    return <div className="text-sm text-destructive">未找到主页设置记录</div>;
  }

  return (
    <div className="space-y-6">
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
      </section>

      {/* Welcome */}
      <section className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
        <h3 className="font-serif text-lg">左侧欢迎区设置</h3>
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