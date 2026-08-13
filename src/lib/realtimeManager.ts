import { supabase } from "@/lib/supabase";
import { logSilent } from "@/lib/syncEngine";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
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

type InvalidationTarget = {
  queryKey: QueryKey;
  exact: boolean;
};

class RealtimeManager {
  private channel: Subscription | null = null;
  private userId: string | null = null;
  private queryClient: QueryClient | null = null;
  private invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  private dirtyTargets = new Map<string, InvalidationTarget>();
  private lastInvalidatedAt = new Map<string, number>();
  private static readonly INVALIDATION_DELAY_MS = 500;
  private static readonly INVALIDATION_COOLDOWN_MS = 2_000;

  start(userId: string, queryClient: QueryClient) {
    if (this.channel && this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.queryClient = queryClient;
    this.dirtyTargets.clear();
    this.lastInvalidatedAt.clear();
    const channel = supabase.channel(`user:${userId}`);
    this.channel = channel;

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<Record<string, any>>) => this.notify(table, payload),
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
    this.dirtyTargets.clear();
  }

  private notify(table: string, payload: RealtimePostgresChangesPayload<Record<string, any>>) {
    if (!this.userId || !this.queryClient) return;

    const record: Record<string, any> = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) || {};

    switch (table) {
      case "knowledge_bases":
        this.addPendingTarget(["lists", this.userId, "all"], true);
        break;
      case "knowledge_base_folders":
        this.addPendingTarget(["lists", this.userId, "all"], true);
        if (record.id) {
          this.addPendingTarget(["lists", this.userId, "contents", record.id], true);
        }
        break;
      case "folder_note_groups":
        if (record.folder_id) {
          this.addPendingTarget(["lists", this.userId, "contents", record.folder_id], true);
        } else {
          this.addPendingTarget(["lists", this.userId, "all"], true);
        }
        break;
      case "notes":
        if (record.folder_id) {
          this.addPendingTarget(["lists", this.userId, "contents", record.folder_id], true);
        }
        if (record.id) {
          this.addPendingTarget(["lists", this.userId, "note", record.id], true);
        }
        if (!record.folder_id && !record.id) {
          this.addPendingTarget(["lists", this.userId, "all"], true);
        }
        break;
      case "knowledge_base_templates":
        this.addPendingTarget(["knowledge_base_templates", this.userId], true);
        break;
      case "habits":
      case "habit_checkins":
        this.addPendingTarget(["habits", this.userId], false);
        break;
      case "daily_reviews":
        this.addPendingTarget(["dailyReviews", this.userId], false);
        break;
      case "time_management_tasks":
        this.addPendingTarget(["time-management-tasks", this.userId], false);
        this.addPendingTarget(["focus-assistant-tasks", this.userId], false);
        break;
      case "focus_sessions":
        this.addPendingTarget(["focus-sessions", this.userId], false);
        this.addPendingTarget(["focus-assistant-tasks", this.userId], false);
        break;
    }

    if (this.invalidateTimer) return;
    this.invalidateTimer = setTimeout(() => {
      this.invalidateTimer = undefined;
      this.flushInvalidations();
    }, RealtimeManager.INVALIDATION_DELAY_MS);
  }

  private addPendingTarget(queryKey: QueryKey, exact: boolean) {
    const keyId = JSON.stringify({ queryKey, exact });
    this.dirtyTargets.set(keyId, { queryKey, exact });
  }

  private flushInvalidations() {
    if (!this.userId || !this.queryClient) return;
    const targets = Array.from(this.dirtyTargets.values());
    this.dirtyTargets.clear();
    const now = Date.now();

    for (const target of targets) {
      const keyId = JSON.stringify(target);
      if (now - (this.lastInvalidatedAt.get(keyId) ?? 0) < RealtimeManager.INVALIDATION_COOLDOWN_MS) continue;
      if (isQueryPending(target.queryKey)) {
        this.dirtyTargets.set(keyId, target);
        if (!this.invalidateTimer) {
          this.invalidateTimer = setTimeout(() => {
            this.invalidateTimer = undefined;
            this.flushInvalidations();
          }, RealtimeManager.INVALIDATION_DELAY_MS);
        }
        return;
      }
      this.lastInvalidatedAt.set(keyId, now);
      void this.queryClient.invalidateQueries({
        queryKey: target.queryKey,
        exact: target.exact,
        refetchType: "active",
      });
    }
  }
}

export const realtimeManager = new RealtimeManager();

