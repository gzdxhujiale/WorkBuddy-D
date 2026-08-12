import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { timeManagementApi } from "@/services/timeManagementService";
import { Task, QuadrantType, TimeManagementData } from "@/types/timeManagement";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import { supabase } from "@/lib/supabase";
import { throwOnPostgrestError } from "@/lib/sync";
import { queryKeys } from "@/lib/syncEngine";
import { useAuth } from "@/lib/auth";

export function useTimeManagementData() {
  const { userId } = useAuth();
  const QUERY_KEY = queryKeys.timeManagement(userId);
  return useQuery<TimeManagementData>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      return await timeManagementApi.loadAll();
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useFocusTaskOptions() {
  const { userId } = useAuth();
  const QUERY_KEY = queryKeys.focusAssistantTasks(userId);

  return useQuery<Array<Pick<Task, "id" | "title">>>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_management_tasks")
        .select("id, title")
        .is("deleted_at", null)
        .eq("completed", false)
        .order("created_at", { ascending: false });
      throwOnPostgrestError(error, "加载可专注任务");
      return data ?? [];
    },
    staleTime: 5_000,
  });
}

export function useTaskActions() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const QUERY_KEY = queryKeys.timeManagement(userId);

  // Upsert Sync (0ms optimistic cache update + debounced DB persistence for text edits)
  const { trigger: triggerUpsert } = useOptimisticSync<TimeManagementData, Task>({
    queryKey: QUERY_KEY,
    debounceMs: 300,
    updateCache: (old, task) => {
      const current = old ?? { tasks: [] };
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
      const savedUpdatedAt = await timeManagementApi.upsertTask(task);
      if (savedUpdatedAt === undefined) return;
      queryClient.setQueryData<TimeManagementData>(QUERY_KEY, (old) => old ? {
        ...old,
        tasks: old.tasks.map((item) => item.id === task.id && item.updatedAt === task.updatedAt
          ? { ...item, updatedAt: savedUpdatedAt, baseUpdatedAt: savedUpdatedAt } : item),
      } : old);
    },
    getSyncKey: (task) => task.id,
  });

  // Delete Sync
  const { trigger: triggerDelete } = useOptimisticSync<TimeManagementData, string>({
    queryKey: QUERY_KEY,
    debounceMs: 0, // Delete immediately
    updateCache: (old, taskId) => {
      const current = old ?? { tasks: [] };
      return {
        ...current,
        tasks: current.tasks.filter((t) => t.id !== taskId),
      };
    },
    syncFn: async (taskId) => {
      await timeManagementApi.deleteTask(taskId);
    },
    getSyncKey: (taskId) => taskId,
  });

  const addTask = useCallback(
    (
      title: string,
      quadrant: QuadrantType = "Q2"
    ): Task => {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title,
        quadrant,
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
      const current = old ?? { tasks: [] };
      const tasks = current.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return { ...t, ...updates, updatedAt: Date.now(), baseUpdatedAt: t.baseUpdatedAt };
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
    getSyncKey: ({ taskId }) => taskId,
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
