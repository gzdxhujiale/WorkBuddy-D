import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AuthProvider } from "@/lib/auth";
import { setStorageUserId } from "@/lib/userStorage";
import { RealtimeProvider } from "@/components/RealtimeProvider";

export function WindowSessionGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setStorageUserId(data.session?.user.id ?? null);
      setSession(data.session);
    });
  }, []);

  if (session === undefined) return <WindowMessage message="正在验证登录状态…" />;
  if (!session?.user) return <WindowMessage message="登录已失效，请回到主窗口重新登录。" />;
  return <AuthProvider value={{ session, userId: session.user.id }}><RealtimeProvider>{children}</RealtimeProvider></AuthProvider>;
}

function WindowMessage({ message }: { message: string }) {
  return <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">{message}</div>;
}
