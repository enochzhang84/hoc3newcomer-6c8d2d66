import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Sign out immediately so they can't access anything before approval.
    await supabase.auth.signOut();
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-6">📨</div>
          <h1 className="font-serif text-3xl text-foreground mb-3">注册申请已提交</h1>
          <p className="text-muted-foreground mb-2">
            请前往邮箱完成邮件验证。
          </p>
          <p className="text-muted-foreground mb-8">
            验证后还需主管理员在后台为您分配权限，才能正式登录系统。
          </p>
          <Link to="/login">
            <Button variant="outline" className="rounded-full">返回登录</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">注册账号</h1>
          <p className="text-muted-foreground text-sm mt-2">
            注册后需主管理员审核分配权限才能登录
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-8 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label>邮箱</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>密码 (至少 6 位)</Label>
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full" size="lg">
            {loading ? "提交中..." : "提交注册"}
          </Button>
          <Link
            to="/login"
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            已有账号? 登录
          </Link>
        </form>
      </div>
    </div>
  );
}