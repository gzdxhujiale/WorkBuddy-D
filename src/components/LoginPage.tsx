import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Fish, Mail, Lock, Eye, EyeOff, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isSignUp = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("请填充邮箱和密码");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg("注册账号成功！请查收验证邮件或直接登录");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg("登录成功！正在进入 FishBuddy...");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "认证失败，请重试";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="flex flex-col items-center justify-center mb-8 space-y-2 text-center">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/20 ring-1 ring-white/20">
            <Fish className="w-9 h-9" />
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              FishBuddy
            </h1>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-sm text-slate-400 font-medium">
            个人使命、时间管理与习惯专注全能助手
          </p>
        </div>

        {/* Card Form */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl font-semibold text-slate-100">
              {isSignUp ? "创建新账号" : "欢迎回来"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {isSignUp
                ? "输入您的电子邮箱注册 FishBuddy 账号"
                : "输入您的凭据登录您的 FishBuddy 账号"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Alert Messages */}
              {errorMsg ? (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              ) : null}

              {successMsg ? (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              ) : null}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  电子邮箱 (Email)
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 border-slate-800 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300">
                    密码 (Password)
                  </Label>
                  {!isSignUp ? (
                    <button
                      type="button"
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={() => setErrorMsg("重置密码链接已发送，请检查邮箱（提示）")}
                    >
                      忘记密码？
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 pr-10 border-slate-800 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 shadow-lg shadow-blue-600/30 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isSignUp ? "正在注册..." : "正在登录..."}
                  </>
                ) : isSignUp ? (
                  "立即注册"
                ) : (
                  "登 录"
                )}
              </Button>

              <div className="text-center text-sm text-slate-400">
                {isSignUp ? "已有账号？" : "还没有账号？"}{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors"
                >
                  {isSignUp ? "直接登录" : "免费注册"}
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Powered by Supabase Engine & FishBuddy • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};
