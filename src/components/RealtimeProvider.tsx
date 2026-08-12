import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { realtimeManager } from "@/lib/realtimeManager";
import { useUiStore } from "@/stores/uiStore";
import { emit, listen } from "@tauri-apps/api/event";

const UI_STATE_EVENT = "fishbuddy:ui-state";
const UI_SOURCE_ID = crypto.randomUUID();

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const setUserId = useUiStore((state) => state.setUserId);
  const hydrateForUser = useUiStore((state) => state.hydrateForUser);
  const queryClient = useQueryClient();

  useEffect(() => {
    hydrateForUser(userId);
    realtimeManager.start(userId, queryClient);
    let disposed = false;
    let suppressBroadcast = false;
    const unlistenPromise = listen<{ source: string; userId: string; activeListId: string | null; isSidebarCollapsed: boolean }>(
      UI_STATE_EVENT,
      (event) => {
        const state = event.payload;
        if (disposed || state.source === UI_SOURCE_ID || state.userId !== userId) return;
        suppressBroadcast = true;
        useUiStore.setState({ activeListId: state.activeListId, isSidebarCollapsed: state.isSidebarCollapsed });
        queueMicrotask(() => { suppressBroadcast = false; });
      },
    );
    const unsubscribe = useUiStore.subscribe((state, previous) => {
      if (suppressBroadcast || state.userId !== userId || (state.activeListId === previous.activeListId && state.isSidebarCollapsed === previous.isSidebarCollapsed)) return;
      void emit(UI_STATE_EVENT, {
        source: UI_SOURCE_ID,
        userId,
        activeListId: state.activeListId,
        isSidebarCollapsed: state.isSidebarCollapsed,
      });
    });
    return () => {
      disposed = true;
      unsubscribe();
      void unlistenPromise.then((unlisten) => unlisten());
      realtimeManager.stop();
      setUserId(null);
    };
  }, [hydrateForUser, queryClient, setUserId, userId]);

  return children;
}
