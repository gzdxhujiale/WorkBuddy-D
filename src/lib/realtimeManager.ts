import { supabase } from "@/lib/supabase";
import { logSilent } from "@/lib/syncEngine";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { isQueryPending } from "@/lib/queryPending";

type Subscription = ReturnType<typeof supabase.channel>;

type SyncBroadcast = {
  table?: string;
  operation?: "INSERT" | "UPDATE" | "DELETE";
  id?: string;
  folder_id?: string | null;
  previous_folder_id?: string | null;
};

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
    const channel = supabase.channel(`user:${userId}:sync`, {
      config: { private: true },
    });
    this.channel = channel;

    channel.on("broadcast", { event: "entity_changed" }, ({ payload }) => {
      const event = payload as SyncBroadcast;
      if (event.table && TABLES.includes(event.table as typeof TABLES[number])) {
        this.notify(event.table, event);
      }
    });

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        logSilent("Realtime", `user Broadcast subscription ${status}`);
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

  private notify(table: string, payload: SyncBroadcast) {
    if (!this.userId || !this.queryClient) return;

    switch (table) {
      case "knowledge_bases":
        this.addPendingTarget(["lists", this.userId, "all"], true);
        break;
      case "knowledge_base_folders":
        this.addPendingTarget(["lists", this.userId, "all"], true);
        if (payload.id) {
          this.addPendingTarget(["lists", this.userId, "contents", payload.id], true);
        }
        break;
      case "folder_note_groups":
        if (payload.folder_id) {
          this.addPendingTarget(["lists", this.userId, "contents", payload.folder_id], true);
        }
        if (payload.previous_folder_id && payload.previous_folder_id !== payload.folder_id) {
          this.addPendingTarget(["lists", this.userId, "contents", payload.previous_folder_id], true);
        } else {
          if (!payload.folder_id) this.addPendingTarget(["lists", this.userId, "all"], true);
        }
        break;
      case "notes":
        if (payload.folder_id) {
          this.addPendingTarget(["lists", this.userId, "contents", payload.folder_id], true);
        }
        if (payload.previous_folder_id && payload.previous_folder_id !== payload.folder_id) {
          this.addPendingTarget(["lists", this.userId, "contents", payload.previous_folder_id], true);
        }
        if (payload.id) {
          this.addPendingTarget(["lists", this.userId, "note", payload.id], true);
        }
        if (!payload.folder_id && !payload.previous_folder_id && !payload.id) {
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

    let hasDeferred = false;
    for (const target of targets) {
      const keyId = JSON.stringify(target);
      if (now - (this.lastInvalidatedAt.get(keyId) ?? 0) < RealtimeManager.INVALIDATION_COOLDOWN_MS) continue;
      if (isQueryPending(target.queryKey)) {
        // Re-queue only this target; other targets in the batch continue below.
        this.dirtyTargets.set(keyId, target);
        hasDeferred = true;
        continue;
      }
      this.lastInvalidatedAt.set(keyId, now);
      void this.queryClient.invalidateQueries({
        queryKey: target.queryKey,
        exact: target.exact,
        refetchType: "active",
      });
    }
    if (hasDeferred && !this.invalidateTimer) {
      this.invalidateTimer = setTimeout(() => {
        this.invalidateTimer = undefined;
        this.flushInvalidations();
      }, RealtimeManager.INVALIDATION_DELAY_MS);
    }
  }
}

export const realtimeManager = new RealtimeManager();

