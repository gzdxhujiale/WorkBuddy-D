import { Task, QuadrantType } from "@/types/timeManagement";

export function getTaskEndAt(task: Task): number | undefined {
  return task.scheduledEndAt;
}

export function getTaskStartAt(task: Task): number | undefined {
  return task.scheduleMode === "range" ? task.scheduledStartAt : undefined;
}

export function isTaskOverdue(task: Task, now: number = Date.now()): boolean {
  if (task.completed || !task.scheduledEndAt) return false;
  return task.scheduledEndAt < now;
}

export function getOverdueDurationLabel(scheduledEndAt: number, now: number = Date.now()): string {
  if (scheduledEndAt >= now) return "今日截止";
  const diffMs = now - scheduledEndAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) {
    return `已逾期 ${Math.max(1, mins)}m`;
  }
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) {
    return `已逾期 ${hours}h`;
  }
  const days = Math.floor(diffMs / 86400000);
  return `已逾期 ${days}d`;
}

export function taskIntersectsInterval(task: Task, intervalStart: number, intervalEnd: number): boolean {
  const end = getTaskEndAt(task);
  if (!end) return false;

  const start = getTaskStartAt(task);
  if (!start) return end >= intervalStart && end < intervalEnd;
  return start < intervalEnd && end > intervalStart;
}

export function taskIntersectsDay(task: Task, date: Date): boolean {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return taskIntersectsInterval(task, dayStart, dayEnd);
}

/**
 * Checks whether a task belongs to the Today workspace view:
 * 1. It is scheduled for today (intersects today); OR
 * 2. It is an uncompleted task from the past (overdue).
 */
export function taskBelongsToToday(task: Task, date: Date = new Date()): boolean {
  if (taskIntersectsDay(task, date)) return true;

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (!task.completed && task.scheduledEndAt && task.scheduledEndAt < dayStart) {
    return true;
  }
  return false;
}

export function taskTimeLabel(task: Task, now: number = Date.now()): string | undefined {
  const end = getTaskEndAt(task);
  if (!end) return undefined;

  if (isTaskOverdue(task, now)) {
    return getOverdueDurationLabel(end, now);
  }

  const endDate = new Date(end);
  const endTime = endDate.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const start = getTaskStartAt(task);
  if (!start) return `截止 ${endTime}`;
  const startTime = new Date(start).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${startTime}–${endTime}`;
}

const QUADRANT_PRIORITY: Record<QuadrantType, number> = {
  Q2: 1,
  Q1: 2,
  Q3: 3,
  Q4: 4,
};

export function sortTasksByQuadrantAndDeadline(tasks: Task[], now: number = Date.now()): Task[] {
  return [...tasks].sort((a, b) => {
    // Completed tasks always at the bottom
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    // Quadrant priority
    const pA = QUADRANT_PRIORITY[a.quadrant] ?? 99;
    const pB = QUADRANT_PRIORITY[b.quadrant] ?? 99;
    if (pA !== pB) return pA - pB;

    // Overdue tasks within the same quadrant placed first
    const aOverdue = isTaskOverdue(a, now);
    const bOverdue = isTaskOverdue(b, now);
    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }

    const timeA = a.scheduledEndAt ?? Number.MAX_SAFE_INTEGER;
    const timeB = b.scheduledEndAt ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;

    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}


