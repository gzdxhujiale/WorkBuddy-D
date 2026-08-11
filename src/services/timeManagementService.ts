import { supabase } from "@/lib/supabase";
import {
  Task,
  Role,
  TimeManagementData,
  QUADRANT_DB_MAP,
  DB_QUADRANT_MAP,
  QuadrantType,
  ScheduleMode,
} from "@/types/timeManagement";

const LOCAL_STORAGE_KEY = "fishbuddy_tm_tasks_v1";

const DEFAULT_ROLES: Role[] = [
  { id: "role-1", name: "个人成长", color: "#1f6fd1", sort_order: 1 },
  { id: "role-2", name: "工作事业", color: "#25845a", sort_order: 2 },
  { id: "role-3", name: "健康生活", color: "#d97706", sort_order: 3 },
  { id: "role-4", name: "家庭社交", color: "#7657d6", sort_order: 4 },
];

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

function getLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error("Failed to save local tasks:", e);
  }
}

export const timeManagementApi = {
  loadAll: async (): Promise<TimeManagementData> => {
    try {
      // 1. Load roles
      let roles: Role[] = DEFAULT_ROLES;
      const { data: rolesData, error: rolesErr } = await supabase
        .from("mission_roles")
        .select("*")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (!rolesErr && rolesData && rolesData.length > 0) {
        roles = rolesData.map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color || "#1f6fd1",
          sort_order: r.sort_order,
        }));
      }

      // 2. Load tasks
      const { data: dbTasks, error: tasksErr } = await supabase
        .from("time_management_tasks")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (tasksErr) {
        console.warn("Supabase tasks query warning, fallback to local:", tasksErr.message);
        return { roles, tasks: getLocalTasks() };
      }

      if (dbTasks && dbTasks.length >= 0) {
        const tasks: Task[] = dbTasks.map((t) => ({
          id: t.id,
          title: t.title,
          quadrant: (DB_QUADRANT_MAP[t.quadrant] || "Q2") as QuadrantType,
          roleId: t.role_id || undefined,
          scheduleMode: t.schedule_mode || undefined,
          scheduledStartAt: t.scheduled_start_at ? new Date(t.scheduled_start_at).getTime() : undefined,
          scheduledEndAt: t.scheduled_end_at ? new Date(t.scheduled_end_at).getTime() : undefined,
          completed: Boolean(t.completed),
          completedAt: t.completed_at ? new Date(t.completed_at).getTime() : undefined,
          description: t.description || undefined,
          reminder: typeof t.reminder === "string" ? t.reminder : t.reminder ? JSON.stringify(t.reminder) : undefined,
          createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
        }));

        saveLocalTasks(tasks);
        return { roles, tasks };
      }
    } catch (err) {
      console.warn("Using local storage fallback for tasks:", err);
    }

    return { roles: DEFAULT_ROLES, tasks: getLocalTasks() };
  },

  upsertTask: async (task: Task): Promise<void> => {
    const schedule = resolveSchedule(task);

    // 1. Always update local storage for immediate responsiveness
    const current = getLocalTasks();
    const idx = current.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      current[idx] = task;
    } else {
      current.push(task);
    }
    saveLocalTasks(current);

    // 2. Sync to Supabase
    try {
      const payload = {
        id: task.id,
        title: task.title,
        quadrant: QUADRANT_DB_MAP[task.quadrant] || task.quadrant,
        role_id: task.roleId || null,
        schedule_mode: schedule.scheduleMode || null,
        scheduled_start_at: schedule.scheduledStartAt
          ? new Date(schedule.scheduledStartAt).toISOString()
          : null,
        scheduled_end_at: schedule.scheduledEndAt
          ? new Date(schedule.scheduledEndAt).toISOString()
          : null,
        completed: task.completed,
        completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        description: task.description || null,
        reminder: task.reminder ? JSON.parse(task.reminder) : null,
        created_at: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("time_management_tasks").upsert(payload);
      if (error) {
        console.warn("Supabase upsert task warning:", error.message);
      }
    } catch (e) {
      console.warn("Supabase task save exception:", e);
    }
  },

  deleteTask: async (id: string): Promise<void> => {
    // 1. Remove from local storage
    const current = getLocalTasks().filter((t) => t.id !== id);
    saveLocalTasks(current);

    // 2. Soft delete in Supabase
    try {
      const { error } = await supabase
        .from("time_management_tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.warn("Supabase delete task warning:", error.message);
      }
    } catch (e) {
      console.warn("Supabase delete task exception:", e);
    }
  },
};
