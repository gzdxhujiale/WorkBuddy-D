import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/lib/syncEngine";
import { timeManagementApi } from "./timeManagementService";
import { apiClient } from "@/lib/apiClient";
import type { Task } from "@/types/task";

export const timeManagementQueries = {
  all: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.timeManagement(userId),
      queryFn: () => timeManagementApi.loadAll(userId),
      enabled: Boolean(userId),
      staleTime: 1000 * 60 * 5,
    }),

  focusTasks: (userId: string) =>
    queryOptions<Array<Pick<Task, "id" | "title" | "projectId">>>({
      queryKey: queryKeys.focusAssistantTasks(userId),
      queryFn: async () => {
        const tasks = await apiClient.get<any[]>("/api/v1/tasks");
        return (tasks ?? [])
          .filter((row) => !row.completed)
          .map((row) => ({
            id: row.id,
            title: row.title,
            projectId: row.project_id || row.projectId || undefined,
          }));
      },
      enabled: Boolean(userId),
      staleTime: 5_000,
    }),
};
