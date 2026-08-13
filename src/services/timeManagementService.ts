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

async function saveRemoteTask(task: Task): Promise<number> {
  const schedule = resolveSchedule(task);
  const { data, error } = await supabase.rpc("save_time_management_task", {
    p_id: task.id, p_title: task.title, p_quadrant: QUADRANT_DB_MAP[task.quadrant] || task.quadrant,
    p_schedule_mode: schedule.scheduleMode || null,
    p_scheduled_start_at: schedule.scheduledStartAt ? new Date(schedule.scheduledStartAt).toISOString() : null,
    p_scheduled_end_at: schedule.scheduledEndAt ? new Date(schedule.scheduledEndAt).toISOString() : null,
    p_completed: task.completed,
    p_description: task.description || null, p_reminder: task.reminder ? JSON.parse(task.reminder) : null,
    p_expected_updated_at: task.baseUpdatedAt ? new Date(task.baseUpdatedAt).toISOString() : null,
  });
  throwOnPostgrestError(error, "保存任务");
  return new Date(data as string).getTime();
}
registerOfflineExecutor("task:save", async (payload) => { await saveRemoteTask(payload as Task); });
registerOfflineExecutor("task:delete", async (payload) => {
  const { error } = await supabase.rpc("soft_delete_time_management_task", { p_id: payload as string });
  throwOnPostgrestError(error, "删除任务");
});

export const timeManagementApi = {
  loadAll: async (userId: string): Promise<TimeManagementData> => {
    try {
      const { data: dbTasks, error: tasksErr } = await supabase
        .from("time_management_tasks")
        .select("id,title,quadrant,schedule_mode,scheduled_start_at,scheduled_end_at,completed,completed_at,description,reminder,created_at,updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
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
          createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
          updatedAt: t.updated_at ? new Date(t.updated_at).getTime() : undefined,
          baseUpdatedAt: t.updated_at ? new Date(t.updated_at).getTime() : undefined,
        }));

        return { tasks };
      }
    } catch (err) {
      throw err;
    }

    return { tasks: [] };
  },

  upsertTask: async (task: Task): Promise<number | undefined> => {
    return runOrQueue({ kind: "task:save", key: `task:${task.id}`, payload: task }, () => saveRemoteTask(task));
  },

  deleteTask: async (id: string): Promise<void> => {
    await runOrQueue({ kind: "task:delete", key: `task:${id}`, payload: id }, async () => {
      const { error } = await supabase.rpc("soft_delete_time_management_task", { p_id: id });
      throwOnPostgrestError(error, "删除任务");
    });
  },
};
