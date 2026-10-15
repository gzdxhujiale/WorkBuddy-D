import { useEffect, useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/app/routes/router";
import { LoginPage, AuthProvider, authService, type AuthSession } from "@/features/auth";
import { queryClient } from "@/lib/queryClient";
import { showFocusAssistant } from "@/app/windows/focusAssistantWindowManager";
import { discardQuickEditDraft } from "@/app/windows/quickEditWindowManager";
import { focusAssistantApi } from "@/features/focus/api/focusAssistantService";
import { shouldOpenFocusAssistantOnStart, applyAppThemeStyle } from "@/lib/preferences";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { setStorageUserId } from "@/lib/userStorage";
import { flushOfflineQueue } from "@/lib/offlineSyncQueue";
import { RealtimeProvider } from "@/app/providers/RealtimeProvider";
import { useUiStore } from "@/stores/uiStore";
import { prefetchTieredData, resetStartupPrefetch } from "@/lib/startupPrefetch";

function App() {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);

  useEffect(() => {
    // 0. 初始化全局视觉风格
    applyAppThemeStyle();

    // 1. 获取当前会话（首次加载）
    const initialSession = authService.getSession();
    setStorageUserId(initialSession?.user.id ?? null);
    setSession(initialSession);

    // 2. 监听登录 / 登出状态变化
    const { data: { subscription } } = authService.onAuthStateChange((_event, newSession) => {
      // A cache from the previous account must never render for the next one.
      // The quick editor belongs to the previous account's in-memory state;
      // discard rather than committing its draft during an auth transition.
      discardQuickEditDraft();
      resetStartupPrefetch();
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
    let scaleTimer: ReturnType<typeof setTimeout> | undefined;
    const setupListener = async () => {
      try {
        const window = getCurrentWindow();
        if (window.label === "main") {
          unlisten = await window.onScaleChanged(() => {
            if (scaleTimer) clearTimeout(scaleTimer);
            scaleTimer = setTimeout(async () => {
              await window.setSize(new LogicalSize(1030, 750)).catch(() => undefined);
            }, 100);
          });
        }
      } catch {
        // 非 Tauri 环境忽略
      }
    };
    setupListener();
    return () => {
      if (scaleTimer) clearTimeout(scaleTimer);
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    // Only the primary webview owns app-start behavior. Secondary webviews
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
      prefetchTieredData(queryClient, session.user.id);
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
  return (
    <AuthProvider value={{ session, userId: session.user.id }}>
      <RealtimeProvider>
        <RouterProvider router={router} />
      </RealtimeProvider>
    </AuthProvider>
  );
}

export default App;
