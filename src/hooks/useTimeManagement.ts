import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { timeManagementApi } from "@/services/timeManagementService";
import { Task, QuadrantType, TimeManagementData } from "@/types/timeManagement";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import { useRealtimeQueryInvalidation } from "@/hooks/useRealtimeQueryInvalidation";

const QUERY_KEY = ["time-management-tasks"];
const TIME_MANAGEMENT_REALTIME_TABLES = ["mission_roles", "time_management_tasks"] as const;

export function useTimeManagementData() {
  useRealtimeQueryInvalidation("time-management", TIME_MANAGEMENT_REALTIME_TABLES, QUERY_KEY);
  return useQuery<TimeManagementData>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      return await timeManagementApi.loadAll();
    },
    staleTime: 1000 * 30,
  });
}

export function useTaskActions() {
  const queryClient = useQueryClient();

  // Upsert Sync (0ms optimistic cache update + debounced DB persistence for text edits)
  const { trigger: triggerUpsert } = useOptimisticSync<TimeManagementData, Task>({
    queryKey: QUERY_KEY,
    debounceMs: 300,
    updateCache: (old, task) => {
      const current = old ?? { roles: [], tasks: [] };
      const idx = current.tasks.findIndex((t) => t.id === task.id);
      let nextTasks: Task[];
      if (idx >= 0) {
        nextTasks = [...current.tasks];
        nextTasks[idx] = task;
      } else {
        nextTasks = [task, ...current.tasks];
      }
      return { ...current, tasks: nextTasks };
    },
    syncFn: async (task) => {
      await timeManagementApi.upsertTask(task);
    },
  });

  // Delete Sync
  const { trigger: triggerDelete } = useOptimisticSync<TimeManagementData, string>({
    queryKey: QUERY_KEY,
    debounceMs: 0, // Delete immediately
    updateCache: (old, taskId) => {
      const current = old ?? { roles: [], tasks: [] };
      return {
        ...current,
        tasks: current.tasks.filter((t) => t.id !== taskId),
      };
    },
    syncFn: async (taskId) => {
      await timeManagementApi.deleteTask(taskId);
    },
  });

  const addTask = useCallback(
    (
      title: string,
      quadrant: QuadrantType = "Q2",
      roleId?: string
    ): Task => {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title,
        quadrant,
        roleId,
        completed: false,
        createdAt: Date.now(),
      };

      triggerUpsert(newTask);
      return newTask;
    },
    [triggerUpsert]
  );

  // Partial Task Update Sync
  const { trigger: triggerUpdate } = useOptimisticSync<
    TimeManagementData,
    { taskId: string; updates: Partial<Task> }
  >({
    queryKey: QUERY_KEY,
    debounceMs: 300,
    updateCache: (old, { taskId, updates }) => {
      const current = old ?? { roles: [], tasks: [] };
      const tasks = current.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return { ...t, ...updates };
      });
      return { ...current, tasks };
    },
    syncFn: async ({ taskId }) => {
      const data = queryClient.getQueryData<TimeManagementData>(QUERY_KEY);
      const target = data?.tasks.find((t: Task) => t.id === taskId);
      if (target) {
        await timeManagementApi.upsertTask(target);
      }
    },
  });

  const updateTask = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      triggerUpdate({ taskId, updates });
    },
    [triggerUpdate]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      triggerDelete(taskId);
    },
    [triggerDelete]
  );

  return {
    addTask,
    updateTask,
    deleteTask,
  };
}
