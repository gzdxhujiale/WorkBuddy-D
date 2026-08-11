import { useEffect } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { logSilent } from "@/lib/syncEngine";

type RealtimeSubscription = {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<() => void>;
  teardownTimer?: ReturnType<typeof setTimeout>;
};

// A Realtime topic can only register its Postgres callbacks before its first
// subscribe(). Several components consume the same query (for example habits
// appears in both the Habits and Today panels), so share one configured channel
// per topic and fan events out to the mounted consumers.
const realtimeSubscriptions = new Map<string, RealtimeSubscription>();

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

    const topic = `${channelName}:${userId}`;
    let subscription = realtimeSubscriptions.get(topic);

    if (!subscription) {
      const channel = supabase.channel(topic);
      subscription = { channel, listeners: new Set() };
      realtimeSubscriptions.set(topic, subscription);

      for (const table of tables) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
          () => {
            for (const listener of subscription!.listeners) listener();
          },
        );
      }

      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logSilent("Realtime", `${channelName} subscription ${status}`);
        }
      });
    } else if (subscription.teardownTimer) {
      clearTimeout(subscription.teardownTimer);
      subscription.teardownTimer = undefined;
    }

    subscription.listeners.add(invalidate);

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      subscription!.listeners.delete(invalidate);
      if (subscription!.listeners.size === 0) {
        // React Strict Mode runs an effect cleanup/setup pair synchronously in
        // development. Delaying the final teardown lets that setup reuse the
        // already-subscribed channel instead of registering callbacks after it.
        subscription!.teardownTimer = setTimeout(() => {
          if (subscription!.listeners.size !== 0) return;
          realtimeSubscriptions.delete(topic);
          void supabase.removeChannel(subscription!.channel);
        }, 0);
      }
    };
  }, [channelName, queryClient, queryKey, tables, userId]);
}
