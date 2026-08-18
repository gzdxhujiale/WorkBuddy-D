import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { timeManagementApi } from "@/services/timeManagementService";
import { Task, QuadrantType, TimeManagementData } from "@/types/timeManagement";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import { supabase } from "@/lib/supabase";
import { throwOnPostgrestError } from "@/lib/sync";
import { hasVersionConflict } from "@/lib/offlineSyncQueue";
import { queryKeys } from "@/lib/syncEngine";
import { useAuth } from "@/lib/auth";
import { createTaskId } from "@/lib/entityIds";

export function useTimeManagementData() {
  const { userId } = useAuth();
  const QUERY_KEY = queryKeys.timeManagement(userId);
  return useQuery<TimeManagementData>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      return await timeManagementApi.loadAll(userId);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useFocusTaskOptions() {
  const { userId } = useAuth();
  const QUERY_KEY = queryKeys.focusAssistantTasks(userId);

  return useQuery<Array<Pick<Task, "id" | "title" | "projectId">>>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_management_tasks")
        .select("id, title, project_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("completed", false)
        .order("created_at", { ascending: false });
      throwOnPostgrestError(error, "加载可专注任务");
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        projectId: row.project_id || undefined,
      }));
    },
    staleTime: 5_000,
  });
}

export function useTaskActions() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const QUERY_KEY = queryKeys.timeManagement(userId);

  // Upsert Sync (optimistic cache update + debounced persistence)
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
      quadrant: QuadrantType = "Q2",
      draft: Partial<Pick<Task, "description" | "scheduleMode" | "scheduledStartAt" | "scheduledEndAt" | "reminder">> = {},
    ): Task => {
      const newTask: Task = {
        id: createTaskId(),
        title,
        quadrant,
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...draft,
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
      if (!target) return;

      try {
        const savedUpdatedAt = await timeManagementApi.upsertTask(target);
        if (savedUpdatedAt === undefined) return;

        // The database is the source of truth for the version. Keeping the
        // old baseUpdatedAt here makes the next edit fail with VERSION_CONFLICT.
        queryClient.setQueryData<TimeManagementData>(QUERY_KEY, (old) => old ? {
          ...old,
          tasks: old.tasks.map((item) => item.id === taskId ? {
            ...item,
            updatedAt: savedUpdatedAt,
            baseUpdatedAt: savedUpdatedAt,
          } : item),
        } : old);
      } catch (error) {
        if (hasVersionConflict(error)) {
          // Do not retry an old optimistic version. Fetch the server version
          // once so the next user edit starts from a current baseUpdatedAt.
          void queryClient.invalidateQueries({ queryKey: QUERY_KEY, refetchType: "active" });
        }
        throw error;
      }
    },
    getSyncKey: ({ taskId }) => taskId,
  });

  const updateTask = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      const current = queryClient
        .getQueryData<TimeManagementData>(QUERY_KEY)
        ?.tasks.find((task) => task.id === taskId);

      // A commit containing no effective change should never create a write.
      if (current && (Object.keys(updates) as Array<keyof Task>).every(
        (key) => Object.is(current[key], updates[key])
      )) {
        return;
      }
      triggerUpdate({ taskId, updates });
    },
    [QUERY_KEY, queryClient, triggerUpdate]
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
