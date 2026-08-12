import { Task, QuadrantType } from "@/types/timeManagement";

export function getTaskEndAt(task: Task): number | undefined {
  return task.scheduledEndAt;
}

export function getTaskStartAt(task: Task): number | undefined {
  return task.scheduleMode === "range" ? task.scheduledStartAt : undefined;
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

export function taskTimeLabel(task: Task): string | undefined {
  const end = getTaskEndAt(task);
  if (!end) return undefined;
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

export function sortTasksByQuadrantAndDeadline(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pA = QUADRANT_PRIORITY[a.quadrant] ?? 99;
    const pB = QUADRANT_PRIORITY[b.quadrant] ?? 99;
    if (pA !== pB) return pA - pB;

    const timeA = a.scheduledEndAt ?? Number.MAX_SAFE_INTEGER;
    const timeB = b.scheduledEndAt ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;

    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}

