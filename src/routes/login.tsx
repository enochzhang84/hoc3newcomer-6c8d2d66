import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { hasSuperAdmin, initSuperAdmin } from "@/lib/backup.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const doHasSuper = useServerFn(hasSuperAdmin);
  const doInitSuper = useServerFn(initSuperAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign("/admin");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message || "";
      let friendly = msg;
      if (/invalid login credentials/i.test(msg)) {
        friendly = "邮箱或密码错误。请确认账号是否已注册，或使用「忘记密码」重置。";
      } else if (/email not confirmed/i.test(msg)) {
        friendly = "邮箱尚未验证，请先到邮箱完成验证后再登录。";
      } else if (/network|fetch/i.test(msg)) {
        friendly = "无法连接到后台服务，请检查 Supabase 配置或网络。";
      }
      console.error("[login] signIn failed:", msg);
      toast.error(friendly);
      setLoading(false);
      return;
    }
    // Check approval: user must have at least one role assigned
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (uid) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!roles || roles.length === 0) {
        const status = await doHasSuper();
        if (!status.hasSuperAdmin) {
          setNeedsFirstAdmin(true);
          toast.info("系统尚未初始化管理员，请先将当前用户设为首位超级管理员。");
        } else {
          await supabase.auth.signOut();
          toast.error("您的账号尚未审核，请联系主管理员授权后再登录");
        }
        setLoading(false);
        return;
      }
    }
    toast.success("登录成功，正在进入管理后台...");
    setTimeout(() => {
      window.location.assign("/admin");
    }, 3000);
  }

  async function handleInitFirstAdmin() {
    setLoading(true);
    try {
      await doInitSuper();
      toast.success("已设为首位超级管理员，正在进入后台...");
      window.location.assign("/admin");
    } catch (e: any) {
      toast.error(`初始化失败：${e?.message || e}`);
      setLoading(false);
    }
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
          {needsFirstAdmin && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-3">
              <p>系统尚未初始化管理员，是否将当前用户设为首位超级管理员？</p>
              <Button type="button" size="sm" onClick={handleInitFirstAdmin} disabled={loading}>
                初始化为首位超级管理员
              </Button>
            </div>
          )}
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