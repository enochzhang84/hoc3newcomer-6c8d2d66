import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) toast.error(error.message);
      else {
        toast.success("注册成功,正在登录...");
        navigate({ to: "/admin" });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate({ to: "/admin" });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">管理后台</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "signin" ? "登录以查看登记名单" : "首次使用?创建管理员账号"}
          </p>
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
            {loading ? "处理中..." : mode === "signin" ? "登录" : "注册并登录"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "首次使用?创建账号 →" : "已有账号?登录 →"}
          </button>
          {mode === "signin" && (
            <Link
              to="/forgot-password"
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              忘记密码?
            </Link>
          )}
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">
          首位注册的用户将自动成为管理员
        </p>
      </div>
    </div>
  );
}