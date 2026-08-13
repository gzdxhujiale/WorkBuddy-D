import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AuthProvider } from "@/lib/auth";
import { setStorageUserId } from "@/lib/userStorage";

export function WindowSessionGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setStorageUserId(nextSession?.user.id ?? null);
      setSession(nextSession);
    };

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => applySession(nextSession),
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) return <WindowMessage message="正在验证登录状态…" />;
  if (!session?.user) return <WindowMessage message="登录已失效，请回到主窗口重新登录。" />;
  // Secondary windows can query and mutate through Supabase, but the main
  // window is the single owner of the shared Realtime subscription.
  return <AuthProvider value={{ session, userId: session.user.id }}>{children}</AuthProvider>;
}

function WindowMessage({ message }: { message: string }) {
  return <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">{message}</div>;
}
