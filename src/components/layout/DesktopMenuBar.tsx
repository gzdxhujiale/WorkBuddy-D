import React from "react";
import { Minus, X } from "lucide-react";

export const DesktopMenuBar: React.FC = () => {
  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) {
      console.log("Minimize window (web fallback):", e);
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
      className="flex items-center justify-between h-[38px] w-full bg-[#f5f5f5] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none flex-shrink-0"
      data-tauri-drag-region
    >
      <div
        className="px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center h-full flex-1"
        data-tauri-drag-region
      >
        FishBuddy
      </div>
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
