import { useEffect, useId, useState } from "react";
import {
  FileText,
  Loader2,
  LogOut,
  Mail,
  Palette,
  Power,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Timer,
  UserRound,
  X,
  Check,
} from "lucide-react";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useAuth } from "@/lib/auth";
import {
  setOpenFocusAssistantOnStart as persistOpenFocusAssistantOnStart,
  shouldOpenFocusAssistantOnStart,
  AppThemeStyle,
} from "@/lib/preferences";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { supabase } from "@/lib/supabase";
import { ProjectTemplateManager } from "@/components/projects/ProjectTemplateManager";
import { Switch } from "@/components/ui/switch";
import {
  PixelFlame,
  PixelSword,
  PixelShield,
  PixelSparkle,
  PixelScroll,
} from "@/components/pixel/PixelIcons";
import { cn } from "@/lib/utils";

type Tab = "account" | "general" | "templates";

const tabs: Array<{ id: Tab; label: string; icon: typeof Settings2 }> = [
  { id: "account", label: "账号", icon: UserRound },
  { id: "general", label: "通用设置", icon: SlidersHorizontal },
  { id: "templates", label: "模板管理", icon: FileText },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("general");
  const [openFocusAssistantOnStart, setOpenFocusAssistantOnStart] = useState(shouldOpenFocusAssistantOnStart);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(true);
  const { themeStyle, setThemeStyle, isPixelTheme } = useAppThemeStyle();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const titleId = useId();
  const current = tabs.find((item) => item.id === tab)!;
  const email = session?.user.email ?? "未设置邮箱";
  const metadata = session?.user.user_metadata;
  const profileUsername = [metadata?.username, metadata?.name, metadata?.full_name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const username = profileUsername ?? email.split("@")[0] ?? "未设置用户名";

  useEffect(() => {
    let active = true;
    isAutostartEnabled()
      .then((enabled) => {
        if (active) setAutostartEnabled(enabled);
      })
      .catch((err) => {
        console.warn("Failed to check autostart status:", err);
      })
      .finally(() => {
        if (active) setAutostartLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleToggleAutostart = async (checked: boolean) => {
    setAutostartLoading(true);
    try {
      if (checked) {
        await enableAutostart();
        setAutostartEnabled(true);
      } else {
        await disableAutostart();
        setAutostartEnabled(false);
      }
    } catch (err) {
      console.error("Failed to toggle autostart:", err);
      try {
        const currentStatus = await isAutostartEnabled();
        setAutostartEnabled(currentStatus);
      } catch {}
    } finally {
      setAutostartLoading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleFocusAssistantOnStart = () => {
    setOpenFocusAssistantOnStart((enabled) => {
      const next = !enabled;
      persistOpenFocusAssistantOnStart(next);
      return next;
    });
  };

  const handleSelectThemeStyle = (style: AppThemeStyle) => {
    setThemeStyle(style);
  };

  const signOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError(null);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setSignOutError(error.message || "退出登录失败，请稍后重试。");
      setSigningOut(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "flex h-[min(600px,calc(100vh-2rem))] w-[min(900px,calc(100vw-2rem))] overflow-hidden bg-card text-card-foreground transition-all",
          isPixelTheme
            ? "rounded-xs border-2 border-border/90 shadow-[6px_6px_0px_rgba(0,0,0,0.3)] font-mono"
            : "rounded-xl border border-border shadow-2xl"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Left Sidebar */}
        <aside
          className={cn(
            "w-52 shrink-0 p-3 select-none",
            isPixelTheme
              ? "border-r-2 border-border/90 bg-amber-50/50 dark:bg-amber-950/40 font-mono"
              : "border-r border-border bg-muted/40"
          )}
        >
          <div className="mb-3 flex items-center gap-2 px-2 py-2 text-base font-semibold text-foreground">
            {isPixelTheme ? (
              <PixelShield size={18} className="text-amber-600 dark:text-amber-400" />
            ) : (
              <Settings2 size={18} />
            )}
            <span className={cn(isPixelTheme && "font-mono font-bold")}>
              {isPixelTheme ? "冒险配置" : "设置"}
            </span>
          </div>
          <nav aria-label="设置分类" className="space-y-1.5">
            {tabs.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-all",
                    isPixelTheme
                      ? isActive
                        ? "rounded-xs border-2 border-amber-900/60 bg-amber-200/90 dark:bg-amber-900/80 font-mono font-bold text-amber-950 dark:text-amber-100 shadow-[2px_2px_0px_#000] translate-x-0.5"
                        : "rounded-xs border-2 border-transparent text-muted-foreground hover:bg-amber-100/50 dark:hover:bg-amber-950/50 hover:text-foreground font-mono"
                      : isActive
                      ? "rounded-md border border-border bg-card font-medium text-primary shadow-xs"
                      : "rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <Icon size={16} />
                  {isPixelTheme
                    ? item.id === "account"
                      ? "冒险家账号"
                      : item.id === "general"
                      ? "核心设定"
                      : "战术模板"
                    : item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex min-w-0 flex-1 flex-col bg-card">
          {/* Header */}
          <header
            className={cn(
              "flex h-13 shrink-0 items-center justify-between px-8 select-none",
              isPixelTheme
                ? "border-b-2 border-border/90 bg-card font-mono shadow-[0_2px_0px_rgba(0,0,0,0.03)]"
                : "border-b border-border"
            )}
          >
            <h2
              id={titleId}
              className={cn(
                "text-foreground",
                isPixelTheme ? "font-mono font-black text-base" : "font-semibold"
              )}
            >
              {isPixelTheme
                ? current.id === "account"
                  ? "冒险家账号档案"
                  : current.id === "general"
                  ? "核心系统设定"
                  : "战术模板管理"
                : current.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭设置"
              className={cn(
                "cursor-pointer text-muted-foreground transition-all",
                isPixelTheme
                  ? "p-1 rounded-xs border border-border bg-muted/40 hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                  : "rounded p-2 hover:bg-accent hover:text-foreground"
              )}
            >
              <X size={18} />
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8">
            {tab === "account" ? (
              <div className="space-y-6">
                <div
                  className={cn(
                    "flex items-center gap-4 pb-6",
                    isPixelTheme ? "border-b-2 border-border/90 font-mono" : "border-b border-border"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center",
                      isPixelTheme
                        ? "rounded-xs border-2 border-amber-900/60 bg-amber-200/90 dark:bg-amber-950 text-amber-900 dark:text-amber-200 shadow-[2px_2px_0px_#000]"
                        : "rounded-full bg-primary/10 text-primary"
                    )}
                  >
                    <UserRound size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className={cn("truncate font-semibold text-foreground", isPixelTheme && "font-mono font-bold text-base")}>
                      {username}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isPixelTheme ? "当前登录冒险家" : "当前登录账号"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div
                    className={cn(
                      "flex items-center gap-3 p-4",
                      isPixelTheme
                        ? "rounded-xs border-2 border-border/90 bg-card shadow-[2px_2px_0px_#000] font-mono"
                        : "rounded-lg border border-border"
                    )}
                  >
                    <Mail size={18} className={cn("shrink-0", isPixelTheme ? "text-amber-600 dark:text-amber-400" : "text-primary")} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{isPixelTheme ? "信件信箱 (邮箱)" : "邮箱"}</p>
                      <p className="mt-1 truncate font-medium text-foreground">{email}</p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-3 p-4",
                      isPixelTheme
                        ? "rounded-xs border-2 border-border/90 bg-card shadow-[2px_2px_0px_#000] font-mono"
                        : "rounded-lg border border-border"
                    )}
                  >
                    <UserRound size={18} className={cn("shrink-0", isPixelTheme ? "text-amber-600 dark:text-amber-400" : "text-primary")} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{isPixelTheme ? "冒险家代号 (用户名)" : "用户名"}</p>
                      <p className="mt-1 truncate font-medium text-foreground">{username}</p>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-4 p-4",
                    isPixelTheme
                      ? "rounded-xs border-2 border-red-900/60 bg-red-50/80 dark:bg-red-950/40 shadow-[2px_2px_0px_rgba(127,29,29,0.3)] font-mono"
                      : "rounded-lg border border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div>
                    <h3 className="font-medium text-foreground">
                      {isPixelTheme ? "解除冒险者契约 (退出登录)" : "退出登录"}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isPixelTheme
                        ? "仅注销当前设备连接，云端存档与其他设备的冒险记录安全保留。"
                        : "仅退出当前设备，其他设备的登录状态不会受影响。"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60",
                      isPixelTheme
                        ? "rounded-xs border-2 border-red-900 bg-red-600 hover:bg-red-700 text-white font-bold shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                        : "rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    )}
                  >
                    {signingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    {signingOut ? "注销中…" : isPixelTheme ? "解除契约" : "退出登录"}
                  </button>
                  {signOutError ? <p role="alert" className="w-full text-sm text-destructive font-mono">{signOutError}</p> : null}
                </div>
              </div>
            ) : tab === "general" ? (
              <div className="space-y-8">
                {/* 界面视觉风格选择器 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    {isPixelTheme ? <PixelSparkle size={18} /> : <Palette size={18} className="text-primary" />}
                    <div>
                      <h3 className={cn("text-foreground", isPixelTheme ? "font-mono font-bold text-sm" : "font-semibold")}>
                        {isPixelTheme ? "界面视觉与交互风格" : "界面视觉风格"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isPixelTheme ? "切换现代极简或 8-bit RPG 像素冒险模式" : "选择你喜爱的设计语言与交互风格"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    {/* 选项 1: 现代简洁风 */}
                    <div
                      onClick={() => handleSelectThemeStyle("default")}
                      className={cn(
                        "relative flex flex-col p-4 cursor-pointer transition-all duration-200",
                        isPixelTheme
                          ? themeStyle === "default"
                            ? "rounded-xs border-2 border-primary bg-primary/10 shadow-[2px_2px_0px_#000] font-mono"
                            : "rounded-xs border-2 border-border/80 bg-card hover:bg-accent/40 shadow-[1px_1px_0px_rgba(0,0,0,0.1)] font-mono"
                          : themeStyle === "default"
                          ? "rounded-xl border-2 border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                          : "rounded-xl border-2 border-border hover:border-muted-foreground/40 bg-card hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-8 h-8 flex items-center justify-center",
                              isPixelTheme
                                ? "rounded-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-900/40"
                                : "rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            )}
                          >
                            <Sparkles size={18} />
                          </div>
                          <span className={cn("text-sm font-bold text-foreground", isPixelTheme && "font-mono")}>
                            现代简洁风
                          </span>
                        </div>
                        {themeStyle === "default" && (
                          <span
                            className={cn(
                              "flex items-center justify-center w-5 h-5 text-xs",
                              isPixelTheme
                                ? "rounded-xs bg-primary text-primary-foreground border border-primary-foreground/40 shadow-[1px_1px_0px_#000]"
                                : "rounded-full bg-primary text-primary-foreground"
                            )}
                          >
                            <Check size={13} className="stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        现代简约矢量设计、柔和阴影与清爽的生产力办公界面。
                      </p>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                        <span
                          className={cn(
                            "inline-block px-1.5 py-0.5 bg-muted text-muted-foreground",
                            isPixelTheme ? "rounded-xs font-mono" : "rounded"
                          )}
                        >
                          现代排版
                        </span>
                        <span
                          className={cn(
                            "inline-block px-1.5 py-0.5 bg-muted text-muted-foreground",
                            isPixelTheme ? "rounded-xs font-mono" : "rounded"
                          )}
                        >
                          简约清新
                        </span>
                      </div>
                    </div>

                    {/* 选项 2: 复古像素风 */}
                    <div
                      onClick={() => handleSelectThemeStyle("retro-pixel")}
                      className={cn(
                        "relative flex flex-col p-4 cursor-pointer transition-all duration-200",
                        isPixelTheme
                          ? themeStyle === "retro-pixel"
                            ? "rounded-xs border-2 border-amber-900 bg-amber-200/90 dark:bg-amber-950/90 shadow-[3px_3px_0px_#000] ring-2 ring-amber-500 font-mono"
                            : "rounded-xs border-2 border-border/80 bg-card hover:bg-amber-100/40 dark:hover:bg-amber-950/40 shadow-[1px_1px_0px_rgba(0,0,0,0.1)] font-mono"
                          : themeStyle === "retro-pixel"
                          ? "rounded-xl border-2 border-amber-700/80 bg-amber-100/50 dark:bg-amber-950/40 shadow-[2px_2px_0px_rgba(120,53,15,0.4)] ring-1 ring-amber-600"
                          : "rounded-xl border-2 border-border hover:border-muted-foreground/40 bg-card hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-8 h-8 flex items-center justify-center",
                              isPixelTheme
                                ? "rounded-xs bg-amber-500/30 text-amber-900 dark:text-amber-200 border-2 border-amber-900/60 shadow-[1px_1px_0px_#000]"
                                : "rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-900/30"
                            )}
                          >
                            <PixelFlame size={18} />
                          </div>
                          <span className="font-bold text-sm text-foreground font-mono">
                            复古像素风
                          </span>
                        </div>
                        {themeStyle === "retro-pixel" && (
                          <span
                            className={cn(
                              "flex items-center justify-center w-5 h-5 text-xs text-white",
                              isPixelTheme
                                ? "rounded-xs bg-emerald-600 border-2 border-emerald-800 shadow-[1px_1px_0px_#064e3b]"
                                : "rounded-md bg-amber-600 border border-amber-800 shadow-[1px_1px_0px_#000]"
                            )}
                          >
                            <Check size={13} className="stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        8-bit 点阵像素、RPG 冒险成就系统、草地打卡与 +10 EXP 跳字激励。
                      </p>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-mono font-bold",
                            isPixelTheme ? "rounded-xs border border-amber-900/30" : "rounded"
                          )}
                        >
                          <PixelSword size={11} /> 8-bit RPG
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-mono font-bold",
                            isPixelTheme ? "rounded-xs border border-emerald-900/30" : "rounded"
                          )}
                        >
                          <PixelScroll size={11} /> 草地热力图
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn("pt-6 space-y-4", isPixelTheme ? "border-t-2 border-border/90 font-mono" : "border-t border-border")}>
                  {/* 开机自启动开关 */}
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <Power size={19} className={cn(isPixelTheme ? "text-amber-600 dark:text-amber-400" : "text-primary")} />
                      <div>
                        <h3 className={cn("text-foreground", isPixelTheme ? "font-mono font-bold text-sm" : "font-medium")}>
                          {isPixelTheme ? "开机自动启程 (开机自启动)" : "开机自启动"}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isPixelTheme ? "开机登录操作系统后，自动启动 WorkBuddy 冒险工坊" : "开机登录系统后自动启动 WorkBuddy"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={autostartEnabled}
                      onCheckedChange={handleToggleAutostart}
                      disabled={autostartLoading}
                      ariaLabel={isPixelTheme ? "开机自启动" : "开机自启动"}
                    />
                  </div>

                  {/* 启动时打开悬浮专注助手 */}
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <Timer size={19} className={cn(isPixelTheme ? "text-amber-600 dark:text-amber-400" : "text-primary")} />
                      <div>
                        <h3 className={cn("text-foreground", isPixelTheme ? "font-mono font-bold text-sm" : "font-medium")}>
                          {isPixelTheme ? "启动时自动召唤悬浮专注助手" : "启动时打开悬浮专注助手"}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isPixelTheme ? "启动冒险工坊时，自动召唤桌面精灵专注伙伴" : "打开应用后自动显示专注助手"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={openFocusAssistantOnStart}
                      onCheckedChange={toggleFocusAssistantOnStart}
                      ariaLabel={isPixelTheme ? "启动时自动召唤悬浮专注助手" : "启动时打开悬浮专注助手"}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <ProjectTemplateManager />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
