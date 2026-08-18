import { useEffect, useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { Session } from "@supabase/supabase-js";
import { router } from "./router";
import { supabase } from "@/lib/supabase";
import { LoginPage } from "@/components/LoginPage";
import { AuthProvider } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { showFocusAssistant } from "@/services/focusAssistantWindow";
import { discardQuickEditDraft } from "@/services/quickEditWindow";
import { focusAssistantApi } from "@/services/focusAssistantService";
import { shouldOpenFocusAssistantOnStart, applyAppThemeStyle } from "@/lib/preferences";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { setStorageUserId } from "@/lib/userStorage";
import { flushOfflineQueue } from "@/lib/offlineSyncQueue";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { useUiStore } from "@/stores/uiStore";

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // 0. 初始化全局视觉风格
    applyAppThemeStyle();

    // 1. 获取当前会话（首次加载）
    supabase.auth.getSession().then(({ data }) => {
      setStorageUserId(data.session?.user.id ?? null);
      setSession(data.session);
    });

    // 2. 监听登录 / 登出状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // A cache from the previous account must never render for the next one.
      // The quick editor belongs to the previous account's in-memory state;
      // discard rather than committing its draft during an auth transition.
      discardQuickEditDraft();
      queryClient.clear();
      useUiStore.getState().setUserId(null);
      setStorageUserId(newSession?.user.id ?? null);
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 修复无边框窗口在 Windows 上跨越不同缩放比例显示器时的尺寸异常问题
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        const window = getCurrentWindow();
        if (window.label === "main") {
          unlisten = await window.onScaleChanged(async () => {
            await window.setSize(new LogicalSize(1030, 750)).catch(() => undefined);
          });
        }
      } catch {
        // 非 Tauri 环境忽略
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    // Only the primary webview owns app-start behavior.  Secondary webviews
    // (e.g. quick-edit or focus assistant) share the same auth storage.
    void (async () => {
      try {
        if (getCurrentWindow().label === "main" && shouldOpenFocusAssistantOnStart()) {
          await showFocusAssistant();
        }
      } catch {
        // Browser builds do not expose a Tauri window label.
      }
    })();
    const onUnload = () => { void focusAssistantApi.markOpenSessionsInterrupted(); };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cleanup: (() => void) | undefined;
    void (async () => {
      let isPrimary = true;
      try {
        isPrimary = getCurrentWindow().label === "main";
      } catch {
        isPrimary = true;
      }
      if (!isPrimary) return;
      const flush = () => { void flushOfflineQueue(); };
      flush();
      window.addEventListener("online", flush);
      cleanup = () => window.removeEventListener("online", flush);
    })();
    return () => { cleanup?.(); };
  }, [session]);

  // 正在检测会话中，显示加载态避免闪烁
  if (session === undefined) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span>正在连接...</span>
        </div>
      </div>
    );
  }

  // 未登录，显示登录页
  if (!session) {
    return <LoginPage />;
  }

  // 已登录，进入主应用路由
  return <AuthProvider value={{ session, userId: session.user.id }}><RealtimeProvider><RouterProvider router={router} /></RealtimeProvider></AuthProvider>;
}

export default App;
