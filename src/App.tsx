import { useEffect, useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { Session } from "@supabase/supabase-js";
import { router } from "./router";
import { supabase } from "@/lib/supabase";
import { LoginPage } from "@/components/LoginPage";
import { AuthProvider } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { showFocusAssistant } from "@/services/focusAssistantWindow";
import { focusAssistantApi } from "@/services/focusAssistantService";
import { shouldOpenFocusAssistantOnStart } from "@/lib/preferences";
import { getCurrentWindow } from "@tauri-apps/api/window";

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // 1. 获取当前会话（首次加载）
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // 2. 监听登录 / 登出状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // A cache from the previous account must never render for the next one.
      queryClient.clear();
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    // Only the primary webview owns app-start behavior.  Secondary webviews
    // share the same auth storage, so without this guard a note window could
    // also be treated as a new application start.
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
  return <AuthProvider value={{ session, userId: session.user.id }}><RouterProvider router={router} /></AuthProvider>;
}

export default App;
