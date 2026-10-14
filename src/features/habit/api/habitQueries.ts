import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/lib/syncEngine";
import { habitApi } from "./habitService";

export const habitQueries = {
  all: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.habits(userId),
      queryFn: () => habitApi.loadAll(),
      enabled: Boolean(userId),
      staleTime: 1000 * 60 * 5,
    }),
};
