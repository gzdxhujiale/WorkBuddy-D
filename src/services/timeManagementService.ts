import { supabase } from "@/lib/supabase";
import { throwOnPostgrestError } from "@/lib/sync";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";
import {
  Task,
  TimeManagementData,
  QUADRANT_DB_MAP,
  DB_QUADRANT_MAP,
  QuadrantType,
  ScheduleMode,
  parseReminder,
} from "@/types/timeManagement";


function resolveSchedule(task: Task): {
  scheduleMode: ScheduleMode | undefined;
  scheduledStartAt: number | undefined;
  scheduledEndAt: number | undefined;
} {
  const scheduleMode = task.scheduleMode;
  const scheduledStartAt = task.scheduledStartAt;
  const scheduledEndAt = task.scheduledEndAt;

  if (!scheduleMode) {
    return { scheduleMode: undefined, scheduledStartAt: undefined, scheduledEndAt: undefined };
  }

  if (!scheduledEndAt) {
    throw new Error("任务时间必须包含截止时间");
  }

  if (scheduleMode === "point") {
    return { scheduleMode, scheduledStartAt: undefined, scheduledEndAt };
  }

  if (!scheduledStartAt || scheduledEndAt <= scheduledStartAt) {
    throw new Error("任务时间段的结束时间必须晚于开始时间");
  }

  return { scheduleMode, scheduledStartAt, scheduledEndAt };
}

export type SavedTaskVersion = { updatedAt: number; lockVersion: number; sortOrder: number };

async function saveRemoteTask(task: Task): Promise<SavedTaskVersion> {
  const schedule = resolveSchedule(task);
  const { data, error } = await supabase.rpc("save_time_management_task_v2", {
    p_id: task.id, p_title: task.title, p_quadrant: QUADRANT_DB_MAP[task.quadrant] || task.quadrant,
    p_schedule_mode: schedule.scheduleMode || null,
    p_scheduled_start_at: schedule.scheduledStartAt ? new Date(schedule.scheduledStartAt).toISOString() : null,
    p_scheduled_end_at: schedule.scheduledEndAt ? new Date(schedule.scheduledEndAt).toISOString() : null,
    p_completed: task.completed,
    p_description: task.description || null, p_reminder: parseReminder(task.reminder),
    p_project_id: task.projectId || null,
    p_project_stage_id: task.projectStageId || null,
    p_priority: task.priority || "medium",
    p_assignee_name: task.assigneeName || null,
    p_expected_lock_version: task.lockVersion ?? null,
  });
  throwOnPostgrestError(error, "保存任务");
  const saved = (data as Array<{ updated_at: string; lock_version: number; sort_order: number }>)[0];
  return {
    updatedAt: new Date(saved.updated_at).getTime(),
    lockVersion: Number(saved.lock_version),
    sortOrder: Number(saved.sort_order),
  };
}
registerOfflineExecutor("task:save", async (payload) => { await saveRemoteTask(payload as Task); });
registerOfflineExecutor("task:delete", async (payload) => {
  const task = payload as Pick<Task, "id" | "lockVersion">;
  if (task.lockVersion === undefined) throw new Error("任务版本尚未加载，已阻止非条件删除");
  const { error } = await supabase.rpc("soft_delete_time_management_task_v3", { p_id: task.id, p_expected_lock_version: task.lockVersion });
  throwOnPostgrestError(error, "删除任务");
});

export const timeManagementApi = {
  loadAll: async (userId: string): Promise<TimeManagementData> => {
    try {
      const { data: dbTasks, error: tasksErr } = await supabase
        .from("time_management_tasks")
        .select("id,title,quadrant,schedule_mode,scheduled_start_at,scheduled_end_at,completed,completed_at,description,reminder,project_id,project_stage_id,priority,assignee_name,sort_order,created_at,updated_at,lock_version")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false });

      if (tasksErr) {
        console.warn("Supabase tasks query failed:", tasksErr.message);
        throwOnPostgrestError(tasksErr, "加载任务");
      }

      if (dbTasks && dbTasks.length >= 0) {
        const tasks: Task[] = dbTasks.map((t) => ({
          id: t.id,
          title: t.title,
          quadrant: (DB_QUADRANT_MAP[t.quadrant] || "Q2") as QuadrantType,
          scheduleMode: t.schedule_mode || undefined,
          scheduledStartAt: t.scheduled_start_at ? new Date(t.scheduled_start_at).getTime() : undefined,
          scheduledEndAt: t.scheduled_end_at ? new Date(t.scheduled_end_at).getTime() : undefined,
          completed: Boolean(t.completed),
          completedAt: t.completed_at ? new Date(t.completed_at).getTime() : undefined,
          description: t.description || undefined,
          reminder: typeof t.reminder === "string" ? t.reminder : t.reminder ? JSON.stringify(t.reminder) : undefined,
          projectId: t.project_id || undefined,
          projectStageId: t.project_stage_id || undefined,
          priority: t.priority || "medium",
          assigneeName: t.assignee_name || undefined,
          sortOrder: Number(t.sort_order),
          createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
          updatedAt: t.updated_at ? new Date(t.updated_at).getTime() : undefined,
          lockVersion: Number(t.lock_version),
          baseUpdatedAt: t.updated_at ? new Date(t.updated_at).getTime() : undefined,
        }));

        return { tasks };
      }
    } catch (err) {
      throw err;
    }

    return { tasks: [] };
  },

  upsertTask: async (task: Task): Promise<SavedTaskVersion | undefined> => {
    return runOrQueue({ kind: "task:save", key: `task:${task.id}`, payload: task }, () => saveRemoteTask(task));
  },

  deleteTask: async (task: Pick<Task, "id" | "lockVersion">): Promise<void> => {
    if (task.lockVersion === undefined) throw new Error("任务版本尚未加载，已阻止非条件删除");
    await runOrQueue({ kind: "task:delete", key: `task:${task.id}`, payload: task }, async () => {
      const { error } = await supabase.rpc("soft_delete_time_management_task_v3", { p_id: task.id, p_expected_lock_version: task.lockVersion });
      throwOnPostgrestError(error, "删除任务");
    });
  },

  reorderTasks: async (
    movedTask: Pick<Task, "id" | "quadrant" | "scheduleMode" | "scheduledStartAt" | "scheduledEndAt">,
    items: Array<Pick<Task, "id" | "sortOrder" | "lockVersion">>,
  ): Promise<Array<SavedTaskVersion & { id: string }>> => {
    if (items.some((item) => item.lockVersion === undefined || item.sortOrder === undefined)) {
      throw new Error("任务版本或排序尚未加载，已阻止非条件排序");
    }
    const { data, error } = await supabase.rpc("reorder_time_management_tasks_v3", {
      p_moved_task_id: movedTask.id,
      p_target_quadrant: QUADRANT_DB_MAP[movedTask.quadrant] || movedTask.quadrant,
      p_target_schedule_mode: movedTask.scheduleMode || null,
      p_target_scheduled_start_at: movedTask.scheduledStartAt ? new Date(movedTask.scheduledStartAt).toISOString() : null,
      p_target_scheduled_end_at: movedTask.scheduledEndAt ? new Date(movedTask.scheduledEndAt).toISOString() : null,
      p_items: items.map((item) => ({
        id: item.id,
        sort_order: item.sortOrder,
        lock_version: item.lockVersion,
      })),
    });
    throwOnPostgrestError(error, "调整任务顺序");
    return ((data ?? []) as Array<{ id: string; updated_at: string; lock_version: number; sort_order: number }>).map((item) => ({
      id: item.id,
      updatedAt: new Date(item.updated_at).getTime(),
      lockVersion: Number(item.lock_version),
      sortOrder: Number(item.sort_order),
    }));
  },
};
