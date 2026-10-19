import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/lib/syncEngine";
import { dailyReviewApi } from "./dailyReviewService";

export const dailyReviewQueries = {
  all: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.dailyReviews(userId),
      queryFn: () => dailyReviewApi.loadAll(),
      enabled: Boolean(userId),
      staleTime: 1000 * 60 * 5,
    }),

  summaries: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.dailyReviews.summaries(userId),
      queryFn: () => dailyReviewApi.loadSummaries(),
      enabled: Boolean(userId),
      staleTime: 1000 * 60 * 5,
    }),

  detail: (userId: string, date: string) =>
    queryOptions({
      queryKey: queryKeys.dailyReviews.detail(userId, date),
      queryFn: () => dailyReviewApi.loadByDate(date),
      enabled: Boolean(userId) && Boolean(date),
      staleTime: 1000 * 60 * 2,
    }),

  stats: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.dailyReviews.stats(userId),
      queryFn: () => dailyReviewApi.loadStats(),
      enabled: Boolean(userId),
      staleTime: 1000 * 60 * 5,
    }),

  heatmap: (userId: string, year: number) =>
    queryOptions({
      queryKey: queryKeys.dailyReviews.heatmap(userId, year),
      queryFn: () => dailyReviewApi.loadHeatmap(year),
      enabled: Boolean(userId),
      staleTime: 1000 * 60 * 5,
    }),

  snapshots: (userId: string, date: string) =>
    queryOptions({
      queryKey: queryKeys.dailyReviews.snapshots(userId, date),
      queryFn: () => dailyReviewApi.listSnapshots(date),
      enabled: Boolean(userId) && Boolean(date),
      staleTime: 1000 * 60 * 5,
    }),

  snapshotDetail: (userId: string, date: string, snapshotId: string) =>
    queryOptions({
      queryKey: queryKeys.dailyReviews.snapshotDetail(userId, date, snapshotId),
      queryFn: () => dailyReviewApi.getSnapshot(date, snapshotId),
      enabled: Boolean(userId) && Boolean(date) && Boolean(snapshotId),
      staleTime: 1000 * 60 * 10,
    }),
};
