import React, { useState, useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  CalendarCheck,
  ListTodo,
  Sparkles,
  BookCheck,
  Library,
  FolderKanban,
  Settings,
  Copy,
  Minus,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { SettingsDialog } from "./SettingsDialog";
import { Toaster } from "../ui/toast";
import { invoke } from "@tauri-apps/api/core";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";

// ============================================================
// Navigation Tool Items Config
// ============================================================
export interface NavigationTool {
  id: string;
  name: string;
  to: string;
  icon: LucideIcon;
}

export const NAV_TOOLS: NavigationTool[] = [
  { id: "today", name: "当日待办", to: "/today", icon: CalendarCheck },
  { id: "four-quadrants", name: "任务中心", to: "/four-quadrants", icon: ListTodo },
  { id: "projects", name: "项目中心", to: "/projects", icon: FolderKanban },
  { id: "habit", name: "习惯追踪", to: "/habit", icon: Sparkles },
  { id: "lists", name: "知识库", to: "/lists", icon: Library },
  { id: "daily-review", name: "每日复盘", to: "/daily-review", icon: BookCheck },
];

// ============================================================
// Desktop Header / MenuBar Component
// ============================================================
export const DesktopMenuBar: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/window")
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

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) {
      console.log("Minimize window (web fallback):", e);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const current = getCurrentWindow();
      await current.toggleMaximize();
      setIsMaximized(await current.isMaximized());
    } catch (e) {
      console.log("Toggle maximize window error, attempting fallback:", e);
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const current = getCurrentWindow();
        const max = await current.isMaximized();
        if (max) {
          await current.unmaximize();
        } else {
          await current.maximize();
        }
        setIsMaximized(!max);
      } catch (fallbackErr) {
        console.log("Fallback maximize error:", fallbackErr);
      }
    }
  };

  const handleClose = async () => {
    try {
      await invoke("quit_app");
    } catch (e) {
      console.log("Quit app (web fallback):", e);
    }
  };

  return (
    <header
      className={`flex items-center justify-between h-[38px] w-full select-none flex-shrink-0 transition-colors ${
        isPixelTheme
          ? "bg-[#ebd9b5] dark:bg-[#181410] border-b-2 border-[#8c6239]/50 text-amber-950 dark:text-amber-100 font-mono"
          : "bg-[#f5f5f5] dark:bg-slate-900"
      }`}
      data-tauri-drag-region
      onDoubleClick={handleToggleMaximize}
    >
      <div
        className="px-4 text-xs font-bold flex items-center h-full flex-1 gap-2"
        data-tauri-drag-region
      >
        {isPixelTheme && (
          <span className="text-[11px] tracking-wider text-amber-800 dark:text-amber-400 font-mono flex items-center gap-1.5">
            <span>👾</span>
            <span>WORKBUDDY 8-BIT</span>
          </span>
        )}
      </div>

      <div className={`flex h-full items-center ${isPixelTheme ? "pr-2 gap-1.5" : ""}`}>
        <button
          type="button"
          onClick={handleMinimize}
          className={
            isPixelTheme
              ? "w-7 h-6 rounded flex items-center justify-center border border-amber-900/60 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
              : "inline-flex items-center justify-center w-12 h-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          }
          aria-label="最小化"
          title="最小化"
        >
          <Minus size={13} strokeWidth={isPixelTheme ? 2.5 : 2} />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          className={
            isPixelTheme
              ? "w-7 h-6 rounded flex items-center justify-center border border-amber-900/60 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
              : "inline-flex items-center justify-center w-12 h-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          }
          aria-label={isMaximized ? "向下还原" : "最大化"}
          title={isMaximized ? "向下还原" : "最大化"}
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={isPixelTheme ? 2.5 : 2} />
          ) : (
            <Square size={12} strokeWidth={isPixelTheme ? 2.5 : 2} />
          )}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className={
            isPixelTheme
              ? "w-7 h-6 rounded flex items-center justify-center border border-red-900/70 dark:border-red-600 bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] hover:bg-red-500 hover:text-white cursor-pointer"
              : "inline-flex items-center justify-center w-12 h-full text-slate-600 dark:text-slate-400 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
          }
          aria-label="关闭"
          title="关闭"
        >
          <X size={13} strokeWidth={isPixelTheme ? 2.5 : 2} />
        </button>
      </div>
    </header>
  );
};

// ============================================================
// Desktop Sidebar / Toolbar Component
// ============================================================
export interface DesktopToolbarProps {
  onSettingsClick?: () => void;
}

export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({ onSettingsClick }) => {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <aside
      className={`h-full flex flex-col items-center pb-3 pt-[38px] px-1 flex-shrink-0 select-none transition-colors ${
        isPixelTheme
          ? "w-[62px] bg-[#ebd9b5] dark:bg-[#181410] border-r-2 border-[#8c6239]/50 shadow-[2px_0px_0px_rgba(0,0,0,0.06)] font-mono"
          : "w-[58px] bg-[#f5f5f5] dark:bg-slate-900"
      }`}
      data-tauri-drag-region
    >
      <nav className="flex flex-col gap-1.5 w-full items-center pt-1" aria-label="Main Navigation">
        {NAV_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              to={tool.to}
              title={tool.name}
              aria-label={tool.name}
              className={`relative group flex items-center justify-center w-10 h-[38px] transition-all duration-150 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/70 ${
                isPixelTheme ? "rounded-md" : "rounded-lg"
              }`}
              activeProps={{
                className: isPixelTheme
                  ? "bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 border-2 border-amber-800/90 dark:border-amber-500 shadow-[2px_2px_0px_#000] font-bold hover:bg-amber-200 dark:hover:bg-amber-900/80"
                  : "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-semibold hover:bg-white dark:hover:bg-slate-800",
              }}
            >
              <Icon size={19} strokeWidth={isPixelTheme ? 2.2 : 1.9} />

              <span
                className={`pointer-events-none absolute left-14 z-50 whitespace-nowrap px-2.5 py-1 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100 ${
                  isPixelTheme
                    ? "rounded bg-[#2a1d13] text-[#faeed9] border-2 border-amber-700 font-mono shadow-[2px_2px_0px_#000]"
                    : "rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                }`}
              >
                {tool.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-2 w-full flex justify-center">
        <button
          type="button"
          onClick={onSettingsClick}
          className={`relative group flex items-center justify-center w-10 h-[38px] transition-all duration-150 cursor-pointer ${
            isPixelTheme
              ? "rounded-md text-amber-900 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-900/60 border border-transparent hover:border-amber-800/40"
              : "rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/70"
          }`}
          title="设置"
          aria-label="设置"
        >
          <Settings size={18} strokeWidth={isPixelTheme ? 2.2 : 1.9} />
          <span
            className={`pointer-events-none absolute left-14 z-50 whitespace-nowrap px-2.5 py-1 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100 ${
              isPixelTheme
                ? "rounded bg-[#2a1d13] text-[#faeed9] border-2 border-amber-700 font-mono shadow-[2px_2px_0px_#000]"
                : "rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            }`}
          >
            设置
          </span>
        </button>
      </div>
    </aside>
  );
};

// ============================================================
// Main App Layout Component
// ============================================================
export const AppLayout: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div
      className={`flex flex-row w-vw h-vh w-screen h-screen overflow-hidden transition-colors ${
        isPixelTheme
          ? "bg-[#ebd9b5] dark:bg-[#181410] text-[#2c1e14] dark:text-[#faeed9]"
          : "bg-[#f5f5f5] dark:bg-slate-900 text-slate-900 dark:text-slate-100"
      }`}
    >
      {/* Sidebar Toolbar */}
      <DesktopToolbar onSettingsClick={() => setIsSettingsOpen(true)} />

      {/* Main Body Column */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Top Header / MenuBar */}
        <DesktopMenuBar />

        {/* Main Route Content */}
        <main
          className={`relative min-h-0 w-full flex-1 overflow-hidden transition-all ${
            isPixelTheme
              ? "bg-[#fcf7ec] dark:bg-[#15120f] rounded-none border-t-2 border-l-2 border-[#8c6239]/60 dark:border-[#523c28] shadow-none"
              : "bg-slate-50 dark:bg-slate-950 rounded-tl-xl border-t border-l border-slate-200/80 dark:border-slate-800/80 shadow-xs"
          }`}
        >
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full w-full text-slate-400 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  <span>加载模块中...</span>
                </div>
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </main>
      </div>

      {isSettingsOpen && <SettingsDialog onClose={() => setIsSettingsOpen(false)} />}
      <Toaster />
    </div>
  );
};

