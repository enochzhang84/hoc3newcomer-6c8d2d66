import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const searchSchema = z.object({ event: z.string().optional() });

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  component: RegisterPage,
});

function RegisterPage() {
  const { event: eventToken } = Route.useSearch();
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    name_en: "",
    district: "",
    gender: "",
    address: "",
    city: "",
    zip: "",
    phone: "",
    email: "",
    faith: "", // christian | seeker | other
    faith_years: "",
    faith_other: "",
    age_group: "",
    marital_status: "", // married | single
    spouse_name: "",
    referrer_type: "", // self | friend | other
    invited_by: "",
    referrer_other: "",
    wants_visit: false,
    wants_info: false,
    notes: "",
  });

  useEffect(() => {
    if (!eventToken) return;
    supabase
      .from("events")
      .select("id, name")
      .eq("qr_token", eventToken)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEventId(data.id);
          setEventName(data.name);
        }
      });
  }, [eventToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("请填写中文姓名");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("registrations").insert({
      event_id: eventId,
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      district: form.district.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      gender: form.gender || null,
      age_group: form.age_group || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      zip: form.zip.trim() || null,
      faith: form.faith || null,
      faith_years: form.faith === "christian" && form.faith_years ? Number(form.faith_years) : null,
      faith_other: form.faith === "other" ? form.faith_other.trim() || null : null,
      marital_status: form.marital_status || null,
      spouse_name: form.marital_status === "married" ? form.spouse_name.trim() || null : null,
      referrer_type: form.referrer_type || null,
      invited_by: form.referrer_type === "friend" ? form.invited_by.trim() || null : null,
      referrer_other: form.referrer_type === "other" ? form.referrer_other.trim() || null : null,
      wants_visit: form.wants_visit,
      wants_info: form.wants_info,
      notes: form.notes.trim() || null,
      source: eventToken ? "qr" : "manual",
    });
    setSubmitting(false);
    if (error) {
      toast.error("提交失败:" + error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🕊️</div>
          <h1 className="font-serif text-4xl text-foreground mb-4">愿主祝福您</h1>
          <p className="text-muted-foreground mb-8">
            谢谢您完成登记。我们的同工会很快与您联系,期待再次见到您。
          </p>
          <Link to="/">
            <Button variant="outline" className="rounded-full">返回首页</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回</Link>
        <div className="mt-4 mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">新人资料表</p>
          <h1 className="font-serif text-4xl text-foreground">基督之家第三家</h1>
          {eventName && (
            <p className="text-sm text-muted-foreground mt-2">活动:{eventName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          <Field label="区别(选填)">
            <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="例如:北区 / 团契名称" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="姓名(中文)" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="姓名(英文)">
              <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="性别">
              <RadioGroup value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} className="flex gap-4 pt-2">
                {["男", "女"].map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={g} /> <span className="text-sm">{g}</span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <Field label="年龄段">
              <RadioGroup value={form.age_group} onValueChange={(v) => setForm({ ...form, age_group: v })} className="flex flex-wrap gap-3 pt-2">
                {["60岁以上", "40-60岁", "20-39岁"].map((a) => (
                  <label key={a} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={a} /> <span className="text-sm">{a}</span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
          </div>

          <Field label="地址">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="City">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
            </div>
            <Field label="ZIP">
              <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="电话">
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="电邮地址">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>

          <Field label="信仰">
            <RadioGroup value={form.faith} onValueChange={(v) => setForm({ ...form, faith: v })} className="flex flex-wrap gap-4 pt-2">
              {[
                { v: "christian", l: "基督徒" },
                { v: "seeker", l: "慕道友" },
                { v: "other", l: "其他" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
            {form.faith === "christian" && (
              <div className="pt-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">信主</span>
                <Input
                  type="number"
                  min={0}
                  value={form.faith_years}
                  onChange={(e) => setForm({ ...form, faith_years: e.target.value })}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">年</span>
              </div>
            )}
            {form.faith === "other" && (
              <Input
                className="mt-3"
                placeholder="请说明"
                value={form.faith_other}
                onChange={(e) => setForm({ ...form, faith_other: e.target.value })}
              />
            )}
          </Field>

          <Field label="婚姻">
            <RadioGroup value={form.marital_status} onValueChange={(v) => setForm({ ...form, marital_status: v })} className="flex flex-wrap gap-4 pt-2">
              {[
                { v: "married", l: "已婚" },
                { v: "single", l: "单身" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
            {form.marital_status === "married" && (
              <Input
                className="mt-3"
                placeholder="配偶姓名"
                value={form.spouse_name}
                onChange={(e) => setForm({ ...form, spouse_name: e.target.value })}
              />
            )}
          </Field>

          <Field label="介绍人">
            <RadioGroup value={form.referrer_type} onValueChange={(v) => setForm({ ...form, referrer_type: v })} className="flex flex-wrap gap-4 pt-2">
              {[
                { v: "self", l: "自己" },
                { v: "friend", l: "亲友" },
                { v: "other", l: "其他" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
            {form.referrer_type === "friend" && (
              <Input
                className="mt-3"
                placeholder="亲友姓名"
                value={form.invited_by}
                onChange={(e) => setForm({ ...form, invited_by: e.target.value })}
              />
            )}
            {form.referrer_type === "other" && (
              <Input
                className="mt-3"
                placeholder="请说明"
                value={form.referrer_other}
                onChange={(e) => setForm({ ...form, referrer_other: e.target.value })}
              />
            )}
          </Field>

          <div className="space-y-3 pt-2 border-t border-border/50">
            <label className="flex items-center gap-3 cursor-pointer pt-3">
              <Checkbox checked={form.wants_visit} onCheckedChange={(v) => setForm({ ...form, wants_visit: !!v })} />
              <span className="text-sm">我欢迎教会牧者探访我</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={form.wants_info} onCheckedChange={(v) => setForm({ ...form, wants_info: !!v })} />
              <span className="text-sm">我需要教会的资料及联络</span>
            </label>
          </div>

          <Field label="备注 / 代祷事项(选填)">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </Field>

          <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-full">
            {submitting ? "提交中..." : "提交登记"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}