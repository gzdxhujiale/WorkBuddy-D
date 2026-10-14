import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/lib/syncEngine";
import { projectApi } from "./projectService";

export const projectQueries = {
  all: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.projects(userId),
      queryFn: () => projectApi.loadAll(userId),
      enabled: Boolean(userId),
      staleTime: 30_000,
    }),
};
