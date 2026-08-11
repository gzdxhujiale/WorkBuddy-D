import React, { useState, useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  CalendarCheck,
  LayoutGrid,
  Sparkles,
  BookCheck,
  Library,
  Settings,
  Copy,
  Minus,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { SettingsDialog } from "./SettingsDialog";

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
  { id: "four-quadrants", name: "四象限工作台", to: "/four-quadrants", icon: LayoutGrid },
  { id: "habit", name: "习惯追踪", to: "/habit", icon: Sparkles },
  { id: "lists", name: "知识库", to: "/lists", icon: Library },
  { id: "daily-review", name: "每日复盘", to: "/daily-review", icon: BookCheck },
];

// ============================================================
// Desktop Header / MenuBar Component
// ============================================================
export const DesktopMenuBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

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
      console.log("Toggle maximize window (web fallback):", e);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) {
      console.log("Close window (web fallback):", e);
    }
  };

  return (
    <header
      className="flex items-center justify-between h-[38px] w-full bg-[#f5f5f5] dark:bg-slate-900 select-none flex-shrink-0"
      data-tauri-drag-region
    >
      <div
        className="px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center h-full flex-1"
        data-tauri-drag-region
      />
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
  );
};

// ============================================================
// Desktop Sidebar / Toolbar Component
// ============================================================
export interface DesktopToolbarProps {
  onSettingsClick?: () => void;
}

export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({ onSettingsClick }) => {
  return (
    <aside
      className="w-[58px] h-full bg-[#f5f5f5] dark:bg-slate-900 flex flex-col items-center pb-3 pt-[38px] px-1 flex-shrink-0 select-none"
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
              className="relative group flex items-center justify-center w-10 h-[38px] rounded-lg transition-all duration-150 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/70"
              activeProps={{
                className:
                  "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-semibold hover:bg-white dark:hover:bg-slate-800",
              }}
            >
              <Icon size={19} strokeWidth={1.9} />

              <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
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
          className="relative group flex items-center justify-center w-10 h-[38px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/70 transition-all duration-150 cursor-pointer"
          title="设置"
          aria-label="设置"
        >
          <Settings size={18} strokeWidth={1.9} />
          <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="flex flex-row w-vw h-vh w-screen h-screen overflow-hidden bg-[#f5f5f5] dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Sidebar Toolbar */}
      <DesktopToolbar onSettingsClick={() => setIsSettingsOpen(true)} />

      {/* Main Body Column */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Top Header / MenuBar */}
        <DesktopMenuBar />

        {/* Main Route Content */}
        <main className="relative min-h-0 w-full flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 rounded-tl-xl border-t border-l border-slate-200/80 dark:border-slate-800/80 shadow-xs">
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
    </div>
  );
};
