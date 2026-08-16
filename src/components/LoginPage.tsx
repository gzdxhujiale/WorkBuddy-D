import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Fish,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ListTodo,
  Library,
  Timer,
  ShieldCheck,
  Zap,
  Minus,
  Square,
  Copy,
  X,
  ArrowRight,
  KeyRound,
  ChevronLeft,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

type AuthMode = "login" | "signup" | "reset";

const REMEMBERED_EMAIL_KEY = "workbuddy:remembered_email";

interface FeatureHighlight {
  id: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  tag: string;
  tagVariant: "q1" | "q2" | "q3" | "default";
}

const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  {
    id: "quadrant",
    icon: ListTodo,
    title: "四象限时间管理",
    desc: "基于艾森豪威尔法则，告别盲目忙碌，聚焦核心高价值产出。",
    tag: "深度专注",
    tagVariant: "q2",
  },
  {
    id: "habit",
    icon: Sparkles,
    title: "习惯追踪与连胜",
    desc: "微小习惯汇聚质变，可视化连续打卡激励与习惯热力图谱。",
    tag: "自我精进",
    tagVariant: "q3",
  },
  {
    id: "review",
    icon: Library,
    title: "知识罗盘与每日复盘",
    desc: "结构化日志记录与富文本知识库，沉淀个人长期数字资产。",
    tag: "持续复利",
    tagVariant: "default",
  },
  {
    id: "focus",
    icon: Timer,
    title: "桌面悬浮专注助手",
    desc: "随时随地一键呼出番茄钟与快捷便签，沉浸心流状态。",
    tag: "心流守护",
    tagVariant: "q1",
  },
];

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  // 加载记住的邮箱
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch {
      // 忽略存储访问异常
    }
  }, []);

  // 监听 Tauri 窗口最大化状态
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const current = getCurrentWindow();
        setIsMaximized(await current.isMaximized());
        unlisten = await current.onResized(() => {
          void current.isMaximized().then(setIsMaximized);
        });
      })
      .catch(() => undefined);
    return () => unlisten?.();
  }, []);

  // 轮播左侧特性卡片
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % FEATURE_HIGHLIGHTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) {
      console.log("Minimize window:", e);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const current = getCurrentWindow();
      await current.toggleMaximize();
      setIsMaximized(await current.isMaximized());
    } catch (e) {
      console.log("Toggle maximize window:", e);
    }
  };

  const handleClose = async () => {
    try {
      await invoke("quit_app");
    } catch (e) {
      console.log("Quit app:", e);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setErrorMsg("请输入电子邮箱");
      return;
    }

    if (mode !== "reset" && !password) {
      setErrorMsg("请输入密码");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setErrorMsg("密码长度至少需 6 个字符");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("两次输入的密码不一致，请重新检查");
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // 处理记住邮箱
    try {
      if (rememberEmail && cleanEmail) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch {
      // 忽略存储错误
    }

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        setSuccessMsg("注册账号成功！若开启了邮箱验证，请查收邮件后登录。");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        setSuccessMsg("登录成功！正在进入工作台...");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (error) throw error;
        setSuccessMsg("密码重置邮件已发送，请检查您的邮箱收件箱或垃圾箱。");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "认证失败，请重试";
      // 转换常见的 Supabase 英文错误提示为友好的中文
      if (msg.includes("Invalid login credentials")) {
        setErrorMsg("邮箱或密码不正确，请重新输入");
      } else if (msg.includes("Email not confirmed")) {
        setErrorMsg("该邮箱尚未完成验证，请检查邮件或联系管理员");
      } else if (msg.includes("User already registered")) {
        setErrorMsg("该邮箱已被注册，请直接登录");
      } else if (msg.includes("Password should be at least")) {
        setErrorMsg("密码安全度不足，至少需要 6 个字符");
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const activeFeature = FEATURE_HIGHLIGHTS[activeFeatureIndex];
  const ActiveFeatureIcon = activeFeature.icon;

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden select-none bg-[#f5f5f5] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 顶部桌面窗口拖拽与控制栏 (Tauri Frameless Title Bar) */}
      <header
        className="flex items-center justify-between h-[38px] w-full bg-[#f5f5f5] dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 select-none flex-shrink-0 z-50"
        data-tauri-drag-region
      >
        <div
          className="px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 h-full flex-1"
          data-tauri-drag-region
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-600 text-white shadow-xs">
            <Fish className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold tracking-tight text-slate-800 dark:text-slate-200">
            WorkBuddy
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium border border-blue-200/50 dark:border-blue-800/50">
            v0.1.0
          </span>
        </div>

        {/* 窗口操作按钮 */}
        <div className="flex h-full">
          <button
            type="button"
            onClick={handleMinimize}
            className="inline-flex items-center justify-center w-12 h-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="最小化"
            title="最小化"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="inline-flex items-center justify-center w-12 h-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label={isMaximized ? "向下还原" : "最大化"}
            title={isMaximized ? "向下还原" : "最大化"}
          >
            {isMaximized ? <Copy size={13} /> : <Square size={13} />}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center w-12 h-full text-slate-600 dark:text-slate-400 hover:bg-red-600 hover:text-white transition-colors"
            aria-label="关闭"
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* 主体双栏区域 */}
      <div className="relative flex flex-1 w-full min-h-0 overflow-hidden">
        {/* 背景氛围与网格装饰 */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
        <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* 左侧：产品生态展示区 (Hero & Feature Showcase) */}
        <aside className="hidden md:flex flex-col justify-between w-5/12 max-w-[460px] p-8 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md z-10">
          <div>
            {/* 品牌 LOGO & 标语 */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
                <Fish className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  WorkBuddy
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  个人使命 · 效率体系 · 专注罗盘
                </p>
              </div>
            </div>

            {/* 动态特性展示卡片 */}
            <div className="mt-8 space-y-3">
              <div className="p-4.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <ActiveFeatureIcon className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {activeFeature.title}
                    </h2>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {activeFeature.tag}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {activeFeature.desc}
                </p>
              </div>

              {/* 特性切换指示指示器 */}
              <div className="flex items-center gap-1.5 pt-1">
                {FEATURE_HIGHLIGHTS.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveFeatureIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === activeFeatureIndex
                        ? "w-7 bg-blue-600 dark:bg-blue-500"
                        : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                    }`}
                    aria-label={`切换到特性 ${item.title}`}
                  />
                ))}
              </div>
            </div>

            {/* 四象限小预览模块 */}
            <div className="mt-6 p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <span>四象限时间管理矩阵</span>
                <span className="text-blue-600 dark:text-blue-400">高效工作法</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  🔥 紧急·重要 (Q1)
                </div>
                <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 font-medium">
                  🎯 重要·不紧急 (Q2)
                </div>
              </div>
            </div>
          </div>

          {/* 底部信任与技术保障 */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>离线优先</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>实时同步</span>
              </div>
              <div className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-500" />
                <span>端到端隔离</span>
              </div>
            </div>
          </div>
        </aside>

        {/* 右侧：认证交互工作台 (Auth Form Container) */}
        <main className="flex-1 flex items-center justify-center p-6 md:p-10 overflow-y-auto z-10">
          <div className="w-full max-w-md">
            {/* 移动端/小屏下的精简 Branding */}
            <div className="md:hidden flex items-center justify-center gap-2.5 mb-6 text-center">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
                <Fish className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  WorkBuddy
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  全能个人效能与时间管理
                </p>
              </div>
            </div>

            {/* 卡片容器 */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 shadow-xl dark:shadow-2xl backdrop-blur-xl p-6 sm:p-8 transition-all">
              {/* 分段模式切换 Tab */}
              {mode !== "reset" ? (
                <div className="flex p-1 mb-6 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                      mode === "login"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    账号登录
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                      mode === "signup"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    注册新账号
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                    title="返回登录"
                    aria-label="返回登录"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      重置密码
                    </h2>
                  </div>
                </div>
              )}

              {/* 标题 & 副标题 */}
              <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {mode === "login"
                    ? "欢迎回来"
                    : mode === "signup"
                    ? "开启您的 WorkBuddy 旅程"
                    : "找回您的账号密码"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {mode === "login"
                    ? "输入账号凭据以同步您的日程、任务与习惯"
                    : mode === "signup"
                    ? "创建一个新账号，体验全方位沉浸式时间管理"
                    : "我们将向您的注册邮箱发送密码重置链接"}
                </p>
              </div>

              {/* 消息提示框 */}
              {errorMsg ? (
                <div className="flex items-start gap-2.5 p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-600 dark:text-rose-300 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              ) : null}

              {successMsg ? (
                <div className="flex items-start gap-2.5 p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-300 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              ) : null}

              {/* 表单提交 */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 邮箱字段 */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="auth-email"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    电子邮箱 (Email)
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="auth-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="pl-10 h-10 text-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-blue-500 rounded-lg"
                    />
                  </div>
                </div>

                {/* 密码字段（重置模式下隐藏） */}
                {mode !== "reset" ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="auth-password"
                        className="text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        密码 (Password)
                      </Label>
                      {mode === "login" ? (
                        <button
                          type="button"
                          onClick={() => switchMode("reset")}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          忘记密码？
                        </button>
                      ) : null}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="pl-10 pr-10 h-10 text-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-blue-500 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        tabIndex={-1}
                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* 注册模式下的确认密码字段 */}
                {mode === "signup" ? (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="auth-confirm-password"
                      className="text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      确认密码 (Confirm Password)
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="auth-confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="再次输入密码"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="pl-10 h-10 text-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-blue-500 rounded-lg"
                      />
                    </div>
                  </div>
                ) : null}

                {/* 记住邮箱勾选框 (登录模式下展示) */}
                {mode === "login" ? (
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberEmail}
                        onChange={(e) => setRememberEmail(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>记住此邮箱</span>
                    </label>
                  </div>
                ) : null}

                {/* 提交按钮 */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {mode === "login"
                          ? "正在验证登录..."
                          : mode === "signup"
                          ? "正在创建账号..."
                          : "正在发送邮件..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {mode === "login"
                          ? "登 录"
                          : mode === "signup"
                          ? "立即注册"
                          : "发送重置密码邮件"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* 底部模式快捷切换提示 */}
              <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
                {mode === "login" ? (
                  <span>
                    还没有账号？{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      立即免费注册
                    </button>
                  </span>
                ) : mode === "signup" ? (
                  <span>
                    已有账号？{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      返回直接登录
                    </button>
                  </span>
                ) : (
                  <span>
                    想起密码了？{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      返回账号登录
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* 安全与版权脚注 */}
            <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-slate-500">
              WorkBuddy · 个人效能与时间管理助手
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

