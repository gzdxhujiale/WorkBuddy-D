import { useEffect } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { logSilent } from "@/lib/syncEngine";

/**
 * Keeps an active React Query view current when another client changes one of
 * its backing tables. Events are scoped to the signed-in user and coalesced so
 * a multi-row write (or a burst of edits) causes one refetch instead of one per
 * database notification.
 */
export function useRealtimeQueryInvalidation(
  channelName: string,
  tables: readonly string[],
  queryKey: QueryKey,
): void {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  useEffect(() => {
    let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      invalidateTimer = setTimeout(() => {
        invalidateTimer = undefined;
        void queryClient.invalidateQueries({ queryKey, refetchType: "active" });
      }, 100);
    };

    const channel = supabase.channel(`${channelName}:${userId}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        invalidate,
      );
    }
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        logSilent("Realtime", `${channelName} subscription ${status}`);
      }
    });

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      void supabase.removeChannel(channel);
    };
  }, [channelName, queryClient, queryKey, tables, userId]);
}
