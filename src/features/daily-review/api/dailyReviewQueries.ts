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
};
