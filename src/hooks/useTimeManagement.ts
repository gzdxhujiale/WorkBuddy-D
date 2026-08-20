import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { timeManagementApi } from "@/services/timeManagementService";
import { Task, QuadrantType, TimeManagementData } from "@/types/timeManagement";
import { ProjectCenterData, ProjectTask } from "@/types/projects";
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
  const PROJECTS_KEY = queryKeys.projects(userId);

  // Helper: conditionally sync a task to the ProjectCenter cache if it has a projectId
  const syncTaskToProjects = useCallback(
    (task: Task) => {
      if (!task.projectId) return;
      queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => {
        if (!old) return old;
        const pTask = task as ProjectTask;
        const idx = old.tasks.findIndex((t) => t.id === task.id);
        const nextTasks =
          idx >= 0
            ? old.tasks.map((t) => (t.id === task.id ? { ...t, ...pTask, updatedAt: Date.now() } : t))
            : [
                { ...pTask, createdAt: pTask.createdAt || Date.now(), updatedAt: Date.now() },
                ...old.tasks,
              ];
        return { ...old, tasks: nextTasks };
      });
    },
    [queryClient, PROJECTS_KEY]
  );

  const syncDeleteToProjects = useCallback(
    (taskId: string) => {
      queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.filter((t) => t.id !== taskId) };
      });
    },
    [queryClient, PROJECTS_KEY]
  );

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
      queryClient.setQueryData<TimeManagementData>(QUERY_KEY, (old) =>
        old
          ? {
              ...old,
              tasks: old.tasks.map((item) =>
                item.id === task.id && item.updatedAt === task.updatedAt
                  ? { ...item, updatedAt: savedUpdatedAt.updatedAt, baseUpdatedAt: savedUpdatedAt.updatedAt, lockVersion: savedUpdatedAt.lockVersion, sortOrder: savedUpdatedAt.sortOrder, isNew: false }
                  : item
              ),
            }
          : old
      );
      if (task.projectId) {
        queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((item) =>
                  item.id === task.id && item.updatedAt === task.updatedAt
                  ? { ...item, updatedAt: savedUpdatedAt.updatedAt, baseUpdatedAt: savedUpdatedAt.updatedAt, lockVersion: savedUpdatedAt.lockVersion, sortOrder: savedUpdatedAt.sortOrder, isNew: false }
                    : item
                ),
              }
            : old
        );
      }
    },
    getSyncKey: (task) => task.id,
  });

  // Delete Sync
  const { trigger: triggerDelete } = useOptimisticSync<TimeManagementData, Pick<Task, "id" | "lockVersion">>({
    queryKey: QUERY_KEY,
    debounceMs: 0, // Delete immediately
    updateCache: (old, { id: taskId }) => {
      const current = old ?? { tasks: [] };
      return {
        ...current,
        tasks: current.tasks.filter((t) => t.id !== taskId),
      };
    },
    syncFn: async (task) => {
      await timeManagementApi.deleteTask(task);
    },
    getSyncKey: ({ id }) => id,
  });

  const addTask = useCallback(
    (
      title: string,
      quadrant: QuadrantType = "Q2",
      draft: Partial<
        Pick<
          Task,
          | "description"
          | "scheduleMode"
          | "scheduledStartAt"
          | "scheduledEndAt"
          | "reminder"
          | "projectId"
          | "projectStageId"
        >
      > = {}
    ): Task => {
      const newTask: Task = {
        id: createTaskId(),
        title,
        quadrant,
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sortOrder: (queryClient.getQueryData<TimeManagementData>(QUERY_KEY)?.tasks
          .filter((task) => task.quadrant === quadrant)
          .reduce((max, task) => Math.max(max, task.sortOrder ?? -1), -1) ?? -1) + 1,
        ...draft,
      };

      triggerUpsert(newTask);
      syncTaskToProjects(newTask);
      return newTask;
    },
    [triggerUpsert, syncTaskToProjects]
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

        // Update timeManagement cache with authoritative timestamp
        queryClient.setQueryData<TimeManagementData>(QUERY_KEY, (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((item) =>
                  item.id === taskId
                    ? {
                        ...item,
                        updatedAt: savedUpdatedAt.updatedAt,
                        baseUpdatedAt: savedUpdatedAt.updatedAt,
                        lockVersion: savedUpdatedAt.lockVersion,
                        sortOrder: savedUpdatedAt.sortOrder,
                        isNew: false,
                      }
                    : item
                ),
              }
            : old
        );

        // Also update projects cache with authoritative timestamp if it's a project task
        if (target.projectId) {
          queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) =>
            old
              ? {
                  ...old,
                  tasks: old.tasks.map((item) =>
                    item.id === taskId
                      ? {
                          ...item,
                          updatedAt: savedUpdatedAt.updatedAt,
                          baseUpdatedAt: savedUpdatedAt.updatedAt,
                        lockVersion: savedUpdatedAt.lockVersion,
                        sortOrder: savedUpdatedAt.sortOrder,
                          isNew: false,
                        }
                      : item
                  ),
                }
              : old
          );
        }
      } catch (error) {
        if (hasVersionConflict(error)) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEY, refetchType: "active" });
          void queryClient.invalidateQueries({ queryKey: PROJECTS_KEY, refetchType: "active" });
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
      if (
        current &&
        (Object.keys(updates) as Array<keyof Task>).every((key) =>
          Object.is(current[key], updates[key])
        )
      ) {
        return;
      }

      // A new task has no server version. Keep its edits in the creation
      // lifecycle so the debounced insert is replaced, never raced by a
      // separate conditional-update writer for the same client UUID.
      if (current && current.lockVersion === undefined) {
        const nextTask = { ...current, ...updates, updatedAt: Date.now() };
        triggerUpsert(nextTask);
        syncTaskToProjects(nextTask);
        return;
      }

      triggerUpdate({ taskId, updates });

      // Conditional optimistic sync to projects cache (0ms instant UI response for project tasks)
      const targetProjectId =
        updates.projectId !== undefined ? updates.projectId : current?.projectId;
      if (targetProjectId) {
        queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => {
          if (!old) return old;
          const idx = old.tasks.findIndex((t) => t.id === taskId);
          if (idx < 0 && !updates.projectId) return old;
          const updatedTasks =
            idx >= 0
              ? old.tasks.map((t) =>
                  t.id === taskId ? { ...t, ...updates, updatedAt: Date.now() } : t
                )
              : current
              ? [{ ...(current as ProjectTask), ...updates, updatedAt: Date.now() }, ...old.tasks]
              : old.tasks;
          return { ...old, tasks: updatedTasks };
        });
      }
    },
    [QUERY_KEY, PROJECTS_KEY, queryClient, syncTaskToProjects, triggerUpdate, triggerUpsert]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      const task = queryClient.getQueryData<TimeManagementData>(QUERY_KEY)?.tasks.find((item) => item.id === taskId);
      if (!task) return;
      triggerDelete(task);
      syncDeleteToProjects(taskId);
    },
    [QUERY_KEY, queryClient, triggerDelete, syncDeleteToProjects]
  );

  const { trigger: triggerMoveAndReorder } = useOptimisticSync<
    TimeManagementData,
    { taskId: string; updates: Pick<Task, "quadrant" | "scheduleMode" | "scheduledStartAt" | "scheduledEndAt">; orderedIds: string[] }
  >({
    queryKey: QUERY_KEY,
    debounceMs: 0,
    updateCache: (old, { taskId, updates, orderedIds }) => {
      const current = old ?? { tasks: [] };
      const orderById = new Map(orderedIds.map((id, index) => [id, orderedIds.length - index - 1]));
      return {
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id === taskId) return { ...task, ...updates, sortOrder: orderById.get(task.id), updatedAt: Date.now() };
          const sortOrder = orderById.get(task.id);
          return sortOrder === undefined ? task : { ...task, sortOrder, updatedAt: Date.now() };
        }),
      };
    },
    syncFn: async ({ taskId, updates, orderedIds }) => {
      const current = queryClient.getQueryData<TimeManagementData>(QUERY_KEY) ?? { tasks: [] };
      const movedTask = current.tasks.find((task) => task.id === taskId);
      if (!movedTask) throw new Error("任务不存在，无法调整顺序");
      const orderById = new Map(orderedIds.map((id, index) => [id, orderedIds.length - index - 1]));
      const items = orderedIds.map((id) => {
        const task = current.tasks.find((candidate) => candidate.id === id);
        if (!task) throw new Error("排序任务不存在，无法调整顺序");
        return { ...task, sortOrder: orderById.get(id)! };
      });
      const saved = await timeManagementApi.reorderTasks({ ...movedTask, ...updates }, items);
      const versions = new Map(saved.map((item) => [item.id, item]));
      queryClient.setQueryData<TimeManagementData>(QUERY_KEY, (old) => old ? {
        ...old,
        tasks: old.tasks.map((task) => {
          const version = versions.get(task.id);
          return version ? {
            ...task,
            updatedAt: version.updatedAt,
            baseUpdatedAt: version.updatedAt,
            lockVersion: version.lockVersion,
            sortOrder: version.sortOrder,
            isNew: false,
          } : task;
        }),
      } : old);
      queryClient.setQueryData<ProjectCenterData>(PROJECTS_KEY, (old) => old ? {
        ...old,
        tasks: old.tasks.map((task) => {
          const version = versions.get(task.id);
          return version ? { ...task, updatedAt: version.updatedAt, baseUpdatedAt: version.updatedAt, lockVersion: version.lockVersion, sortOrder: version.sortOrder } : task;
        }),
      } : old);
    },
    getSyncKey: ({ taskId }) => taskId,
  });

  const moveAndReorderTask = useCallback(
    (taskId: string, updates: Pick<Task, "quadrant" | "scheduleMode" | "scheduledStartAt" | "scheduledEndAt">, orderedIds: string[]) => {
      triggerMoveAndReorder({ taskId, updates, orderedIds });
    },
    [triggerMoveAndReorder],
  );

  return {
    addTask,
    updateTask,
    deleteTask,
    moveAndReorderTask,
  };
}
