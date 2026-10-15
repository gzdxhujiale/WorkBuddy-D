import { apiClient } from "@/lib/apiClient";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";
import {
  Task,
  TimeManagementData,
  DB_QUADRANT_MAP,
  QUADRANT_DB_MAP,
  QuadrantType,
} from "../types";
import { saveRemoteTask, deleteRemoteTask, type SavedTaskVersion } from "@/lib/taskApi";

export type { SavedTaskVersion };

registerOfflineExecutor("task:save", async (payload) => {
  await saveRemoteTask(payload as Task);
});
registerOfflineExecutor("task:delete", async (payload) => {
  await deleteRemoteTask(payload as Pick<Task, "id" | "lockVersion">);
});

export const timeManagementApi = {
  loadAll: async (_userId: string): Promise<TimeManagementData> => {
    const dbTasks = await apiClient.get<Array<Record<string, unknown>>>("/api/v1/tasks");

    const tasks: Task[] = (dbTasks ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      quadrant: (DB_QUADRANT_MAP[t.quadrant as string] || "Q2") as QuadrantType,
      scheduleMode: (t.schedule_mode as Task["scheduleMode"]) || undefined,
      scheduledStartAt: t.scheduled_start_at ? new Date(t.scheduled_start_at as string).getTime() : undefined,
      scheduledEndAt: t.scheduled_end_at ? new Date(t.scheduled_end_at as string).getTime() : undefined,
      completed: Boolean(t.completed),
      completedAt: t.completed_at ? new Date(t.completed_at as string).getTime() : undefined,
      description: (t.description as string) || undefined,
      reminder: typeof t.reminder === "string" ? t.reminder : t.reminder ? JSON.stringify(t.reminder) : undefined,
      projectId: (t.project_id as string) || undefined,
      projectStageId: (t.project_stage_id as string) || undefined,
      priority: ((t.priority as string) || "medium") as Task["priority"],
      assigneeName: (t.assignee_name as string) || undefined,
      sortOrder: Number(t.sort_order),
      createdAt: t.created_at ? new Date(t.created_at as string).getTime() : Date.now(),
      updatedAt: t.updated_at ? new Date(t.updated_at as string).getTime() : undefined,
      lockVersion: Number(t.lock_version || 1),
      baseUpdatedAt: t.updated_at ? new Date(t.updated_at as string).getTime() : undefined,
    }));

    return { tasks };
  },

  upsertTask: async (task: Task): Promise<SavedTaskVersion | undefined> => {
    return runOrQueue({ kind: "task:save", key: `task:${task.id}`, payload: task }, () => saveRemoteTask(task));
  },

  deleteTask: async (task: Pick<Task, "id" | "lockVersion">): Promise<void> => {
    await runOrQueue({ kind: "task:delete", key: `task:${task.id}`, payload: task }, () => deleteRemoteTask(task));
  },

  reorderTasks: async (
    movedTask: Pick<Task, "id" | "quadrant" | "scheduleMode" | "scheduledStartAt" | "scheduledEndAt">,
    items: Array<Pick<Task, "id" | "sortOrder" | "lockVersion">>,
  ): Promise<Array<SavedTaskVersion & { id: string }>> => {
    const results: Array<SavedTaskVersion & { id: string }> = [];
    for (const item of items) {
      try {
        const payload: Record<string, unknown> = {
          sort_order: item.sortOrder,
          lock_version: item.lockVersion,
        };
        if (item.id === movedTask.id) {
          payload.quadrant = QUADRANT_DB_MAP[movedTask.quadrant] || movedTask.quadrant;
          if (movedTask.scheduleMode !== undefined) {
            payload.schedule_mode = movedTask.scheduleMode;
          }
          if (movedTask.scheduledStartAt !== undefined) {
            payload.scheduled_start_at = movedTask.scheduledStartAt ? new Date(movedTask.scheduledStartAt).toISOString() : null;
          }
          if (movedTask.scheduledEndAt !== undefined) {
            payload.scheduled_end_at = movedTask.scheduledEndAt ? new Date(movedTask.scheduledEndAt).toISOString() : null;
          }
        }
        const updated = await apiClient.put<Record<string, unknown>>(`/api/v1/tasks/${item.id}`, payload);
        results.push({
          id: item.id,
          updatedAt: updated.updated_at ? new Date(updated.updated_at as string).getTime() : Date.now(),
          lockVersion: Number(updated.lock_version || 1),
          sortOrder: Number(updated.sort_order || item.sortOrder),
        });
      } catch {
        // Continue best effort
      }
    }
    return results;
  },
};
