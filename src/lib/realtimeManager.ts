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
] as const;

class RealtimeManager {
  private channel: Subscription | null = null;
  private userId: string | null = null;
  private queryClient: QueryClient | null = null;
  private invalidateTimer: ReturnType<typeof setTimeout> | undefined;

  start(userId: string, queryClient: QueryClient) {
    if (this.channel && this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.queryClient = queryClient;
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
  }

  private notify(table: string) {
    if (!this.userId || !this.queryClient) return;
    const queryKeys: QueryKey[] = [];
    if (["knowledge_bases", "knowledge_base_folders", "folder_note_groups", "notes"].includes(table)) {
      queryKeys.push(["lists", this.userId]);
    }
    if (table === "knowledge_base_templates") queryKeys.push(["knowledge_base_templates", this.userId]);
    if (["habits", "habit_checkins"].includes(table)) queryKeys.push(["habits", this.userId]);
    if (table === "daily_reviews") queryKeys.push(["dailyReviews", this.userId]);
    if (table === "time_management_tasks") {
      queryKeys.push(["time-management-tasks", this.userId]);
    }
    if (table === "time_management_tasks") queryKeys.push(["focus-assistant-tasks", this.userId]);
    const invalidate = () => {
      for (const queryKey of queryKeys) {
        if (isQueryPending(queryKey)) {
          this.invalidateTimer = setTimeout(invalidate, 300);
          return;
        }
        void this.queryClient?.invalidateQueries({ queryKey, refetchType: "active" });
      }
    };
    if (this.invalidateTimer) clearTimeout(this.invalidateTimer);
    this.invalidateTimer = setTimeout(invalidate, 100);
  }
}

export const realtimeManager = new RealtimeManager();
