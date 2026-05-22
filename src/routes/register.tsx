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
    phone: "",
    gender: "",
    age_group: "",
    address: "",
    invited_by: "",
    is_first_visit: true,
    wants_followup: false,
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
      toast.error("请填写姓名");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("registrations").insert({
      event_id: eventId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      gender: form.gender || null,
      age_group: form.age_group || null,
      address: form.address.trim() || null,
      invited_by: form.invited_by.trim() || null,
      is_first_visit: form.is_first_visit,
      wants_followup: form.wants_followup,
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
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">新人登记</p>
          <h1 className="font-serif text-4xl text-foreground">很高兴遇见您</h1>
          {eventName && (
            <p className="text-sm text-muted-foreground mt-2">活动:{eventName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          <Field label="姓名" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="您的姓名" />
          </Field>
          <Field label="电话">
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="方便我们联系您" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="性别">
              <RadioGroup value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} className="flex gap-4 pt-2">
                {["弟兄", "姊妹"].map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={g} /> <span className="text-sm">{g}</span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <Field label="年龄段">
              <select
                value={form.age_group}
                onChange={(e) => setForm({ ...form, age_group: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">请选择</option>
                {["18岁以下", "18-30", "31-45", "46-60", "60以上"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="地址(选填)">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="所在区域" />
          </Field>
          <Field label="邀请人(选填)">
            <Input value={form.invited_by} onChange={(e) => setForm({ ...form, invited_by: e.target.value })} placeholder="是谁邀请您来的?" />
          </Field>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={form.is_first_visit} onCheckedChange={(v) => setForm({ ...form, is_first_visit: !!v })} />
              <span className="text-sm">这是我第一次来</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={form.wants_followup} onCheckedChange={(v) => setForm({ ...form, wants_followup: !!v })} />
              <span className="text-sm">希望牧者/同工与我进一步联系</span>
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