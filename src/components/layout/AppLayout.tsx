import React, { useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { DesktopMenuBar } from "./DesktopMenuBar";
import { DesktopToolbar } from "./DesktopToolbar";
import { SettingsDialog } from "./SettingsDialog";

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

      {isSettingsOpen && <SettingsDialog onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};
