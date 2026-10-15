import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/lib/syncEngine";
import { focusAssistantApi, FocusStats } from "./focusAssistantService";

export const focusQueries = {
  stats: (userId?: string | null) =>
    queryOptions<FocusStats>({
      queryKey: queryKeys.focusStats(userId),
      queryFn: () => focusAssistantApi.getFocusStats(userId ?? undefined),
      enabled: Boolean(userId),
      staleTime: 1000 * 60 * 5,
    }),
};
