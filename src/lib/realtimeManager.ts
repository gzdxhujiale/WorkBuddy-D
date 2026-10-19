import { wsClient, type DeltaEvent } from "@/lib/wsClient";
import { logSilent } from "@/lib/syncEngine";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { isPendingScope, isQueryPending } from "@/lib/queryPending";

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
  "projects",
  "project_stages",
  "project_templates",
] as const;

type InvalidationTarget = {
  queryKey: QueryKey;
  exact: boolean;
};

class RealtimeManager {
  private userId: string | null = null;
  private queryClient: QueryClient | null = null;
  private invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  private dirtyTargets = new Map<string, InvalidationTarget>();
  private lastInvalidatedAt = new Map<string, number>();
  private unsubscribeWs: (() => void) | null = null;

  private static readonly INVALIDATION_DELAY_MS = 300;
  private static readonly INVALIDATION_COOLDOWN_MS = 1_500;

  start(userId: string, queryClient: QueryClient, accessToken: string) {
    if (this.userId === userId && this.unsubscribeWs) return;
    this.stop();
    this.userId = userId;
    this.queryClient = queryClient;
    this.dirtyTargets.clear();
    this.lastInvalidatedAt.clear();

    try {
      wsClient.connect(accessToken, userId);
      this.unsubscribeWs = wsClient.subscribe((event: DeltaEvent) => {
        if (event.table && TABLES.includes(event.table as typeof TABLES[number])) {
          this.notify(event.table, event);
        }
      });
    } catch (err) {
      logSilent("RealtimeManager", "Failed to connect to WebSocket sync hub", err);
    }
  }

  stop() {
    if (this.unsubscribeWs) {
      this.unsubscribeWs();
      this.unsubscribeWs = null;
    }
    wsClient.disconnect(true);
    this.userId = null;
    this.queryClient = null;
    if (this.invalidateTimer) clearTimeout(this.invalidateTimer);
    this.invalidateTimer = undefined;
    this.dirtyTargets.clear();
  }

  private notify(table: string, payload: DeltaEvent) {
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
        } else {
          this.addPendingTarget(["lists", this.userId, "all"], true);
        }
        break;
      case "notes":
        if (payload.folder_id) {
          this.addPendingTarget(["lists", this.userId, "contents", payload.folder_id], true);
        }
        if (payload.id) {
          this.addPendingTarget(["lists", this.userId, "note", payload.id], true);
        }
        if (!payload.folder_id && !payload.id) {
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
      case "daily_reviews": {
        this.addPendingTarget(["dailyReviews", this.userId, "summaries"], true);
        this.addPendingTarget(["dailyReviews", this.userId, "stats"], true);
        this.addPendingTarget(["dailyReviews", this.userId, "all"], true);
        const reviewData = payload.data as { date?: string } | undefined;
        const targetDate = reviewData?.date ? String(reviewData.date).slice(0, 10) : undefined;
        if (targetDate) {
          const detailKey: QueryKey = ["dailyReviews", this.userId, "detail", targetDate];
          if (!isQueryPending(detailKey) && !isPendingScope(`dailyReview:${this.userId}:${targetDate}`)) {
            this.addPendingTarget(detailKey, true);
          }
          const year = Number(targetDate.slice(0, 4));
          if (year) {
            this.addPendingTarget(["dailyReviews", this.userId, "heatmap", year], true);
          }
        } else {
          this.addPendingTarget(["dailyReviews", this.userId, "heatmap"], false);
        }
        break;
      }
      case "time_management_tasks":
        this.addPendingTarget(["time-management-tasks", this.userId], false);
        this.addPendingTarget(["focus-assistant-tasks", this.userId], false);
        this.addPendingTarget(["projects", this.userId], true);
        break;
      case "focus_sessions":
        this.addPendingTarget(["focus-sessions", this.userId], false);
        this.addPendingTarget(["focus-assistant-tasks", this.userId], false);
        break;
      case "projects":
      case "project_stages":
      case "project_templates":
        this.addPendingTarget(["projects", this.userId], true);
        if (table === "projects") {
          this.addPendingTarget(["time-management-tasks", this.userId], true);
        }
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
      const isKnowledgeTarget = target.queryKey[0] === "lists";
      const isDailyReviewDetail =
        target.queryKey[0] === "dailyReviews" &&
        target.queryKey[2] === "detail" &&
        typeof target.queryKey[3] === "string";
      const dailyReviewDate = isDailyReviewDetail ? (target.queryKey[3] as string) : undefined;

      if (
        isQueryPending(target.queryKey) ||
        (isKnowledgeTarget && isPendingScope(`knowledge:${this.userId}`)) ||
        (isDailyReviewDetail && dailyReviewDate && isPendingScope(`dailyReview:${this.userId}:${dailyReviewDate}`))
      ) {
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
