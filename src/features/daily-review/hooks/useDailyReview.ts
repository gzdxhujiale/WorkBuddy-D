import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dailyReviewApi } from "../api/dailyReviewService";
import { dailyReviewQueries } from "../api/dailyReviewQueries";
import { DailyReviewItem, DailyReviewSummary } from "../types";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import { queryKeys } from "@/lib/syncEngine";
import { useAuth } from "@/features/auth";
import { createDailyReviewId } from "@/lib/entityIds";
import { markPendingScope, clearPendingScope } from "@/lib/queryPending";

export function extractReviewPlainText(content?: string): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed === "" || trimmed === "{}") return "";

  try {
    let parsed: any = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      // If wrapped in legacy { text: "..." }
      if (typeof parsed.text === "string" && parsed.text.trim().startsWith("{")) {
        try {
          const inner = JSON.parse(parsed.text.trim());
          if (inner && typeof inner === "object" && inner.type === "doc") {
            parsed = inner;
          }
        } catch {}
      } else if (parsed.text && typeof parsed.text === "object" && parsed.text.type === "doc") {
        parsed = parsed.text;
      }

      const texts: string[] = [];
      const extractText = (node: any) => {
        if (!node || typeof node !== "object") return;
        if (typeof node.text === "string") {
          texts.push(node.text);
        }
        if (Array.isArray(node.content)) {
          for (const child of node.content) {
            extractText(child);
          }
        }
      };
      extractText(parsed);
      return texts.join("").trim();
    }
  } catch {
    // Plain text or legacy HTML
  }

  return trimmed.replace(/<[^>]*>/g, "").trim();
}

export function isReviewEmpty(content: string): boolean {
  return extractReviewPlainText(content).length === 0;
}

export function useDailyReviewData() {
  const { userId } = useAuth();
  return useQuery(dailyReviewQueries.all(userId));
}

export function useDailyReviewSummaries() {
  const { userId } = useAuth();
  return useQuery(dailyReviewQueries.summaries(userId));
}

export function useDailyReviewDetail(date: string) {
  const { userId } = useAuth();
  return useQuery(dailyReviewQueries.detail(userId, date));
}

export function useDailyReviewStats() {
  const { userId } = useAuth();
  return useQuery(dailyReviewQueries.stats(userId));
}

export function useDailyReviewHeatmap(year?: number) {
  const { userId } = useAuth();
  const currentYear = year ?? new Date().getFullYear();
  return useQuery(dailyReviewQueries.heatmap(userId, currentYear));
}

export function useReviewActions() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const DAILY_REVIEW_QUERY_KEY = queryKeys.dailyReviews(userId);

  // Upsert Sync Hook (500ms debounced persistence)
  const { trigger: triggerUpsert } = useOptimisticSync<DailyReviewItem[], DailyReviewItem>({
    queryKey: DAILY_REVIEW_QUERY_KEY,
    debounceMs: 500,
    updateCache: (old, review) => {
      const list = old ?? [];
      const idx = list.findIndex((r) => r.date === review.date);
      const isEmpty = isReviewEmpty(review.content);
      let nextList = list;

      if (isEmpty) {
        nextList = list.filter((r) => r.date !== review.date);
        queryClient.setQueryData(queryKeys.dailyReviews.detail(userId, review.date), null);
      } else if (idx >= 0) {
        nextList = [...list];
        nextList[idx] = review;
        queryClient.setQueryData(queryKeys.dailyReviews.detail(userId, review.date), review);
      } else {
        nextList = [...list, review];
        queryClient.setQueryData(queryKeys.dailyReviews.detail(userId, review.date), review);
      }

      // Update summaries query cache
      queryClient.setQueryData<DailyReviewSummary[]>(queryKeys.dailyReviews.summaries(userId), (prevSummaries) => {
        const sList = prevSummaries ?? [];
        const sIdx = sList.findIndex((s) => s.date === review.date);
        if (isEmpty) {
          return sList.filter((s) => s.date !== review.date);
        }
        if (sIdx >= 0) {
          const nextS = [...sList];
          nextS[sIdx] = { ...nextS[sIdx], updatedAt: review.updatedAt };
          return nextS;
        }
        return [
          {
            id: review.id,
            date: review.date,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            lockVersion: review.lockVersion ?? 1,
          },
          ...sList,
        ];
      });

      return nextList;
    },
    syncFn: async (review) => {
      try {
        const isEmpty = isReviewEmpty(review.content);
        const savedEntity = await dailyReviewApi.upsertReview(review);
        if (savedEntity === undefined) return;

        if (isEmpty) {
          queryClient.setQueryData<DailyReviewItem[]>(DAILY_REVIEW_QUERY_KEY, (old) =>
            old?.filter((item) => item.date !== review.date) ?? old
          );
          queryClient.setQueryData<DailyReviewItem | null>(queryKeys.dailyReviews.detail(userId, review.date), null);
          queryClient.setQueryData<DailyReviewSummary[]>(queryKeys.dailyReviews.summaries(userId), (prevSummaries) =>
            prevSummaries?.filter((s) => s.date !== review.date) ?? []
          );
        } else {
          queryClient.setQueryData<DailyReviewItem[]>(DAILY_REVIEW_QUERY_KEY, (old) =>
            old?.map((item) =>
              item.date === review.date
                ? {
                    ...item,
                    id: savedEntity.id,
                    updatedAt: savedEntity.updatedAt,
                    baseUpdatedAt: savedEntity.updatedAt,
                    lockVersion: savedEntity.lockVersion,
                    isNew: false,
                  }
                : item,
            ) ?? old,
          );

          queryClient.setQueryData<DailyReviewItem | null>(queryKeys.dailyReviews.detail(userId, review.date), (prev) =>
            prev
              ? {
                  ...prev,
                  id: savedEntity.id,
                  updatedAt: savedEntity.updatedAt,
                  baseUpdatedAt: savedEntity.updatedAt,
                  lockVersion: savedEntity.lockVersion,
                  isNew: false,
                }
              : prev
          );
        }

        // Invalidate server stats and heatmap to sync streak and compound growth accurately
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyReviews.stats(userId) });
        const year = Number(review.date.slice(0, 4)) || new Date().getFullYear();
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyReviews.heatmap(userId, year) });
      } finally {
        clearPendingScope(`dailyReview:${userId}:${review.date}`);
      }
    },
    getSyncKey: (review) => review.date,
  });

  const saveReview = useCallback(
    (date: string, content: string): DailyReviewItem => {
      const detailCached = queryClient.getQueryData<DailyReviewItem | null>(queryKeys.dailyReviews.detail(userId, date));
      const listCached = (queryClient.getQueryData<DailyReviewItem[]>(DAILY_REVIEW_QUERY_KEY) ?? []).find((r) => r.date === date);
      const existing = detailCached || listCached;
      const isEmpty = isReviewEmpty(content);

      if (existing && existing.content === content) {
        return existing;
      }
      if (existing && isEmpty && isReviewEmpty(existing.content)) {
        return existing;
      }

      if (isEmpty) {
        const clearedReview: DailyReviewItem = {
          id: existing?.id || createDailyReviewId(),
          date,
          content: "",
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
          baseUpdatedAt: existing?.baseUpdatedAt,
        };
        markPendingScope(`dailyReview:${userId}:${date}`);
        triggerUpsert(clearedReview);
        return clearedReview;
      }

      const review: DailyReviewItem = existing
        ? {
            ...existing,
            content,
            updatedAt: Date.now(),
            baseUpdatedAt: existing.baseUpdatedAt,
          }
        : {
            id: createDailyReviewId(),
            date,
            content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

      markPendingScope(`dailyReview:${userId}:${date}`);
      triggerUpsert(review);
      return review;
    },
    [queryClient, triggerUpsert, DAILY_REVIEW_QUERY_KEY, userId]
  );

  const deleteReview = useCallback(
    (id: string) => {
      const existing = (queryClient.getQueryData<DailyReviewItem[]>(DAILY_REVIEW_QUERY_KEY) ?? [])
        .find((review) => review.id === id);
      if (!existing) return;
      markPendingScope(`dailyReview:${userId}:${existing.date}`);
      triggerUpsert({
        ...existing,
        content: "",
        updatedAt: Date.now(),
        baseUpdatedAt: existing.baseUpdatedAt,
      });
    },
    [queryClient, triggerUpsert, DAILY_REVIEW_QUERY_KEY, userId]
  );

  return { saveReview, deleteReview };
}
