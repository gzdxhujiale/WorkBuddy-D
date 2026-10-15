import { QueryClient } from "@tanstack/react-query";
import { timeManagementQueries } from "@/features/time-management/api/timeManagementQueries";
import { habitQueries } from "@/features/habit/api/habitQueries";
import { dailyReviewQueries } from "@/features/daily-review/api/dailyReviewQueries";
import { queryKeys } from "@/lib/syncEngine";
import * as knowledgeService from "@/features/knowledge/api/knowledgeService";
import { todayYMD } from "@/lib/dateUtils";

let prefetchInitiatedUserId: string | null = null;

/**
 * Tiered startup prefetcher:
 * - L1: Immediate concurrency for critical Workbench items (Tasks, Habits, Today's Review).
 * - L2: Idle-scheduled prewarming for heavier metadata (Knowledge Tree shell, Review Summaries & Compound Stats).
 */
export function prefetchTieredData(queryClient: QueryClient, userId: string): void {
  if (!userId || prefetchInitiatedUserId === userId) return;
  prefetchInitiatedUserId = userId;

  // L1: Immediate Workbench Core
  const today = todayYMD();
  void Promise.allSettled([
    queryClient.prefetchQuery(timeManagementQueries.all(userId)),
    queryClient.prefetchQuery(habitQueries.all(userId)),
    queryClient.prefetchQuery(dailyReviewQueries.detail(userId, today)),
  ]);

  // L2: Idle Prewarm
  const scheduleIdle =
    typeof window !== "undefined" && "requestIdleCallback" in window
      ? (fn: () => void) => (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(fn, { timeout: 2000 })
      : (fn: () => void) => setTimeout(fn, 200);

  scheduleIdle(() => {
    void Promise.allSettled([
      // Knowledge base tree shell
      queryClient.prefetchQuery({
        queryKey: queryKeys.lists.all(userId),
        queryFn: async () => {
          const allData = await knowledgeService.loadAll();
          return {
            folders: allData.folders.map((f) => ({ ...f })),
            lists: allData.lists.map((l) => ({ ...l })),
            noteGroups: allData.noteGroups.map((g) => ({ ...g })),
            notes: allData.notes.map((n) => ({ ...n })),
          };
        },
        staleTime: 1000 * 60 * 5,
      }),
      // Daily review summaries (dates, metadata without heavy JSONB)
      queryClient.prefetchQuery(dailyReviewQueries.summaries(userId)),
      // Server-side compound growth & streak stats
      queryClient.prefetchQuery(dailyReviewQueries.stats(userId)),
    ]);
  });
}

export function resetStartupPrefetch(): void {
  prefetchInitiatedUserId = null;
}
