import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { realtimeManager } from "@/lib/realtimeManager";
import { useUiStore } from "@/stores/uiStore";
import { emit, listen } from "@tauri-apps/api/event";
import { startTaskReminderScheduler, checkTaskReminders } from "@/services/taskReminderScheduler";
import { queryKeys } from "@/lib/syncEngine";
import type { TimeManagementData } from "@/types/timeManagement";

const UI_STATE_EVENT = "workbuddy:ui-state";
const UI_SOURCE_ID = crypto.randomUUID();

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { userId, session } = useAuth();
  const setUserId = useUiStore((state) => state.setUserId);
  const hydrateForUser = useUiStore((state) => state.hydrateForUser);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Mount global task reminder scheduler across the authenticated application
    const getTasks = () => {
      const data = queryClient.getQueryData<TimeManagementData>(queryKeys.timeManagement(userId));
      return data?.tasks ?? [];
    };

    const cleanupScheduler = startTaskReminderScheduler(getTasks);

    // Re-arm immediately whenever the time-management query cache updates
    const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === "time-management-tasks") {
        checkTaskReminders(getTasks());
      }
    });

    return () => {
      cleanupScheduler();
      unsubscribeCache();
    };
  }, [queryClient, userId]);

  useEffect(() => {
    hydrateForUser(userId);
    realtimeManager.start(userId, queryClient, session.access_token);
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
  }, [hydrateForUser, queryClient, session.access_token, setUserId, userId]);

  return children;
}
