import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign("/admin");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    // Use the user id from the sign-in response directly — avoids a second
    // auth round-trip that has been observed to hang in production.
    const uid = signInData.session?.user.id ?? signInData.user?.id;
    if (uid) {
      try {
        const rolesPromise = supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        const result = await Promise.race([
          rolesPromise,
          new Promise<{ data: null }>((resolve) =>
            setTimeout(() => resolve({ data: null }), 4000),
          ),
        ]);
        const roles = (result as { data: { role: string }[] | null }).data;
        if (roles && roles.length === 0) {
          await supabase.auth.signOut();
          toast.error("您的账号尚未审核，请联系主管理员授权后再登录");
          setLoading(false);
          return;
        }
      } catch {
        // Ignore — fall through to redirect; /admin will re-check.
      }
    }
    window.location.assign("/admin");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">管理后台</h1>
          <p className="text-muted-foreground text-sm mt-2">登录以查看登记名单</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-8 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label>邮箱</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full" size="lg">
            {loading ? "处理中..." : "登录"}
          </Button>
          <Link
            to="/forgot-password"
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            忘记密码?
          </Link>
          <Link
            to="/signup"
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            还没有账号? 注册
          </Link>
        </form>
      </div>
    </div>
  );
}