import { supabase } from "@/lib/supabase";
import { logSilent } from "@/lib/syncEngine";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { isQueryPending } from "@/lib/queryPending";

type Subscription = ReturnType<typeof supabase.channel>;

const TABLES = [
  "knowledge_bases",
  "knowledge_base_folders",
  "folder_note_groups",
  "notes",
  "knowledge_base_templates",
  "habits",
  "habit_checkins",
  "daily_reviews",
  "time_management_tasks",
  "focus_sessions",
] as const;

class RealtimeManager {
  private channel: Subscription | null = null;
  private userId: string | null = null;
  private queryClient: QueryClient | null = null;
  private invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  private dirtyTables = new Set<string>();
  private lastInvalidatedAt = new Map<string, number>();
  private static readonly INVALIDATION_DELAY_MS = 500;
  private static readonly INVALIDATION_COOLDOWN_MS = 2_000;

  start(userId: string, queryClient: QueryClient) {
    if (this.channel && this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.queryClient = queryClient;
    this.dirtyTables.clear();
    this.lastInvalidatedAt.clear();
    const channel = supabase.channel(`user:${userId}`);
    this.channel = channel;

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        () => this.notify(table),
      );
    }

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        logSilent("Realtime", `user subscription ${status}`);
      }
    });
  }

  stop() {
    if (this.channel) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.userId = null;
    this.queryClient = null;
    if (this.invalidateTimer) clearTimeout(this.invalidateTimer);
    this.invalidateTimer = undefined;
    this.dirtyTables.clear();
  }

  private notify(table: string) {
    if (!this.userId || !this.queryClient) return;
    this.dirtyTables.add(table);
    if (this.invalidateTimer) return;
    this.invalidateTimer = setTimeout(() => {
      this.invalidateTimer = undefined;
      this.flushInvalidations();
    }, RealtimeManager.INVALIDATION_DELAY_MS);
  }

  private flushInvalidations() {
    if (!this.userId || !this.queryClient) return;
    const tables = [...this.dirtyTables];
    this.dirtyTables.clear();
    const now = Date.now();
    const queryKeys: QueryKey[] = [];
    for (const table of tables) {
      if (["knowledge_bases", "knowledge_base_folders", "folder_note_groups", "notes"].includes(table)) {
        queryKeys.push(["lists", this.userId]);
      }
      if (table === "knowledge_base_templates") queryKeys.push(["knowledge_base_templates", this.userId]);
      if (["habits", "habit_checkins"].includes(table)) queryKeys.push(["habits", this.userId]);
      if (table === "daily_reviews") queryKeys.push(["dailyReviews", this.userId]);
      if (table === "time_management_tasks") {
        queryKeys.push(["time-management-tasks", this.userId]);
        queryKeys.push(["focus-assistant-tasks", this.userId]);
      }
      if (table === "focus_sessions") {
        queryKeys.push(["focus-sessions", this.userId]);
        queryKeys.push(["focus-assistant-tasks", this.userId]);
      }
    }
    const uniqueKeys = queryKeys.filter((key, index, all) =>
      index === all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(key))
    );
    for (const queryKey of uniqueKeys) {
      const keyId = JSON.stringify(queryKey);
      if (now - (this.lastInvalidatedAt.get(keyId) ?? 0) < RealtimeManager.INVALIDATION_COOLDOWN_MS) continue;
      if (isQueryPending(queryKey)) {
        for (const dirtyTable of tables) this.dirtyTables.add(dirtyTable);
        if (!this.invalidateTimer) {
          this.invalidateTimer = setTimeout(() => {
            this.invalidateTimer = undefined;
            this.flushInvalidations();
          }, RealtimeManager.INVALIDATION_DELAY_MS);
        }
        return;
      }
      this.lastInvalidatedAt.set(keyId, now);
      void this.queryClient.invalidateQueries({ queryKey, refetchType: "active" });
    }
  }
}

export const realtimeManager = new RealtimeManager();
