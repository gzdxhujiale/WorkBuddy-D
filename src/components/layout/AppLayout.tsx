import React, { useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { DesktopMenuBar } from "./DesktopMenuBar";
import { DesktopToolbar } from "./DesktopToolbar";

export const AppLayout: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="flex flex-row w-vw h-vh w-screen h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar Toolbar */}
      <DesktopToolbar onSettingsClick={() => setIsSettingsOpen(true)} />

      {/* Main Body Column */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Top Header / MenuBar */}
        <DesktopMenuBar />

        {/* Main Route Content */}
        <main className="relative min-h-0 w-full flex-1 overflow-hidden">
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

      {/* Settings Modal (Placeholder) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 w-96 max-w-[90vw]">
            <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">设置</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              系统偏好与个人配置面板
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
