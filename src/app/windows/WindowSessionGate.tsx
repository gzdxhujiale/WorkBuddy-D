import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, authService, type AuthSession } from "@/features/auth";
import { setStorageUserId } from "@/lib/userStorage";

export function WindowSessionGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const applySession = (nextSession: AuthSession | null) => {
      if (!mounted) return;
      setStorageUserId(nextSession?.user.id ?? null);
      setSession(nextSession);
    };

    const initial = authService.getSession();
    applySession(initial);

    const { data: { subscription } } = authService.onAuthStateChange(
      (_event, nextSession) => applySession(nextSession),
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) return <WindowMessage message="正在验证登录状态…" />;
  if (!session?.user) return <WindowMessage message="登录已失效，请回到主窗口重新登录。" />;
  return <AuthProvider value={{ session, userId: session.user.id }}>{children}</AuthProvider>;
}

function WindowMessage({ message }: { message: string }) {
  return <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">{message}</div>;
}
