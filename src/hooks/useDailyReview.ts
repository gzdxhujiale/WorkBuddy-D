import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dailyReviewApi } from "@/services/dailyReviewService";
import { DailyReviewItem } from "@/types/dailyReview";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import { queryKeys } from "@/lib/syncEngine";
import { useAuth } from "@/lib/auth";
import { createDailyReviewId } from "@/lib/entityIds";

export function isReviewEmpty(content: string): boolean {
  if (!content) return true;
  const trimmed = content.trim();
  if (trimmed === "" || trimmed === "{}") {
    return true;
  }
  try {
    const json = JSON.parse(trimmed);
    if (!json.content || !Array.isArray(json.content) || json.content.length === 0) return true;
    if (json.content.length === 1) {
      const p = json.content[0];
      if (p.type === "paragraph" && (!p.content || p.content.length === 0)) return true;
    }
    return false;
  } catch {
    const stripped = trimmed.replace(/<[^>]*>/g, "").trim();
    return stripped.length === 0;
  }
}

export function useDailyReviewData() {
  const { userId } = useAuth();
  const queryKey = queryKeys.dailyReviews(userId);
  return useQuery({
    queryKey,
    queryFn: () => dailyReviewApi.loadAll(),
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}

export function useReviewActions() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const DAILY_REVIEW_QUERY_KEY = queryKeys.dailyReviews(userId);

  // Upsert Sync Hook (500ms debounced persistence to Supabase)
  const { trigger: triggerUpsert } = useOptimisticSync<DailyReviewItem[], DailyReviewItem>({
    queryKey: DAILY_REVIEW_QUERY_KEY,
    debounceMs: 500,
    updateCache: (old, review) => {
      const list = old ?? [];
      const idx = list.findIndex((r) => r.date === review.date);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = review;
        return next;
      }
      return [...list, review];
    },
    syncFn: async (review) => {
      const savedUpdatedAt = await dailyReviewApi.upsertReview(review);
      if (savedUpdatedAt === undefined) return;
      queryClient.setQueryData<DailyReviewItem[]>(DAILY_REVIEW_QUERY_KEY, (old) =>
        old?.map((item) =>
          item.id === review.id && item.updatedAt === review.updatedAt
            ? { ...item, updatedAt: savedUpdatedAt.updatedAt, baseUpdatedAt: savedUpdatedAt.updatedAt, lockVersion: savedUpdatedAt.lockVersion, isNew: false }
            : item,
        ) ?? old,
      );
    },
    getSyncKey: (review) => review.date,
  });

  const saveReview = useCallback(
    (date: string, content: string): DailyReviewItem => {
      const prev = queryClient.getQueryData<DailyReviewItem[]>(DAILY_REVIEW_QUERY_KEY) ?? [];
      const existing = prev.find((r) => r.date === date);
      const isEmpty = isReviewEmpty(content);

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
    [queryClient, triggerUpsert]
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
    [queryClient, triggerUpsert]
  );

  return { saveReview, deleteReview };
}
