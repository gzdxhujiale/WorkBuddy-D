import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dailyReviewApi } from "../api/dailyReviewService";
import { dailyReviewQueries } from "../api/dailyReviewQueries";
import { DailyReviewItem, DailyReviewSummary } from "../types";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import { queryKeys } from "@/lib/syncEngine";
import { useAuth } from "@/features/auth";
import { createDailyReviewId } from "@/lib/entityIds";

export function extractReviewPlainText(content?: string): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed === "" || trimmed === "{}") return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
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
      let nextList = list;
      if (idx >= 0) {
        nextList = [...list];
        nextList[idx] = review;
      } else {
        nextList = [...list, review];
      }

      // Update detail query cache directly
      queryClient.setQueryData(queryKeys.dailyReviews.detail(userId, review.date), review);

      // Update summaries query cache
      queryClient.setQueryData<DailyReviewSummary[]>(queryKeys.dailyReviews.summaries(userId), (prevSummaries) => {
        const sList = prevSummaries ?? [];
        const sIdx = sList.findIndex((s) => s.date === review.date);
        const isEmpty = isReviewEmpty(review.content);
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
      const savedEntity = await dailyReviewApi.upsertReview(review);
      if (savedEntity === undefined) return;

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

      // Invalidate server stats to sync streak and compound growth accurately
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReviews.stats(userId) });
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

      if (isEmpty) {
        if (existing) {
          const clearedReview: DailyReviewItem = {
            ...existing,
            content: "",
            updatedAt: Date.now(),
            baseUpdatedAt: existing.baseUpdatedAt,
          };
          triggerUpsert(clearedReview);
          return clearedReview;
        }
        return { id: "", date, content: "", createdAt: Date.now(), updatedAt: Date.now() };
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
      triggerUpsert({
        ...existing,
        content: "",
        updatedAt: Date.now(),
        baseUpdatedAt: existing.baseUpdatedAt,
      });
    },
    [queryClient, triggerUpsert, DAILY_REVIEW_QUERY_KEY]
  );

  return { saveReview, deleteReview };
}
