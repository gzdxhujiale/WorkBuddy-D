import { apiClient } from "./apiClient";
import {
  Task,
  QUADRANT_DB_MAP,
  ScheduleMode,
  parseReminder,
} from "@/types/task";

function asTimestamp(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : Date.now();
}

export function resolveSchedule(task: Task): {
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

export async function saveRemoteTask(task: Task): Promise<SavedTaskVersion> {
  const schedule = resolveSchedule(task);
  const payload = {
    id: task.id,
    title: task.title,
    quadrant: QUADRANT_DB_MAP[task.quadrant] || task.quadrant,
    schedule_mode: schedule.scheduleMode || null,
    scheduled_start_at: schedule.scheduledStartAt ? new Date(schedule.scheduledStartAt).toISOString() : null,
    scheduled_end_at: schedule.scheduledEndAt ? new Date(schedule.scheduledEndAt).toISOString() : null,
    completed: task.completed,
    completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    description: task.description || null,
    reminder: parseReminder(task.reminder),
    project_id: task.projectId || null,
    project_stage_id: task.projectStageId || null,
    priority: task.priority || "medium",
    assignee_name: task.assigneeName || null,
    sort_order: task.sortOrder,
    lock_version: task.lockVersion ?? 1,
  };

  const isCreate = Boolean(task.isNew || !task.lockVersion);
  const saved = isCreate
    ? await apiClient.post<{ updated_at?: string; lock_version?: number; sort_order?: number }>(`/api/v1/tasks`, payload)
    : await apiClient.put<{ updated_at?: string; lock_version?: number; sort_order?: number }>(`/api/v1/tasks/${task.id}`, payload);

  return {
    updatedAt: asTimestamp(saved.updated_at),
    lockVersion: Number(saved.lock_version || 1),
    sortOrder: Number(saved.sort_order || 0),
  };
}

export async function deleteRemoteTask(task: Pick<Task, "id" | "lockVersion">): Promise<void> {
  await apiClient.delete(`/api/v1/tasks/${task.id}`);
}
