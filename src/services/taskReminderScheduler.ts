import dayjs from "dayjs";
import { Task, parseReminder, TaskReminder } from "@/types/timeManagement";
import { sendDesktopNotification, requestNotificationPermission } from "./notificationService";

const notifiedTasks = new Set<string>();
const NOTIFIED_STORAGE_KEY = "workbuddy_task_reminders_v1";
const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function readNotifiedTasks(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
    const entries = JSON.parse(raw ?? "[]") as Array<[string, number]>;
    const cutoff = Date.now() - NOTIFICATION_RETENTION_MS;
    const retained = entries.filter(([key, sentAt]) => typeof key === "string" && typeof sentAt === "number" && sentAt >= cutoff);
    if (retained.length !== entries.length) localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(retained));
    return new Set(retained.map(([key]) => key));
  } catch {
    return new Set();
  }
}

function markNotified(key: string): void {
  notifiedTasks.add(key);
  try {
    const cutoff = Date.now() - NOTIFICATION_RETENTION_MS;
    const existing = JSON.parse(localStorage.getItem(NOTIFIED_STORAGE_KEY) ?? "[]") as Array<[string, number]>;
    const next = [...existing.filter(([savedKey, sentAt]) => savedKey !== key && sentAt >= cutoff), [key, Date.now()] as [string, number]];
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Notification delivery must still work if local storage is unavailable.
  }
}

export function getTaskTargetDate(task: Task): dayjs.Dayjs {
  if (task.scheduledEndAt) return dayjs(task.scheduledEndAt);
  return dayjs(task.createdAt);
}

export function computeTaskReminderTime(task: Task): number | null {
  if (task.completed) return null;

  const rem: TaskReminder | null = parseReminder(task.reminder);
  if (rem) {
    const targetDate = getTaskTargetDate(task).subtract(rem.offsetDays, "day");
    const [h, m] = (rem.time || "09:00").split(":").map(Number);
    const remTime = targetDate.hour(h).minute(m).second(0).millisecond(0).valueOf();
    return remTime;
  }

  if (task.scheduledEndAt) {
    return task.scheduledEndAt;
  }

  return null;
}

export function checkTaskReminders(tasks: Task[]): void {
  const now = Date.now();
  const persistedNotified = readNotifiedTasks();

  tasks.forEach((task) => {
    if (task.completed) return;

    const remTime = computeTaskReminderTime(task);
    if (!remTime) return;

    const key = `${task.id}-${remTime}`;
    // A reminder is delivered once even if the app was closed at its exact
    // scheduled minute. The persisted key prevents duplicate delivery on a
    // restart; changing the reminder produces a new key.
    if (now >= remTime && !notifiedTasks.has(key) && !persistedNotified.has(key)) {
      markNotified(key);

      const targetDate = getTaskTargetDate(task);
      const dateText = targetDate.format("M月D日 HH:mm");
      const title = `⏰ 任务提醒: ${task.title}`;
      const body = `「${task.title}」已到提醒时间（${dateText}）`;

      void sendDesktopNotification(title, body);
    }
  });
}

let schedulerTimer: number | null = null;

export function startTaskReminderScheduler(getTasks: () => Task[]): () => void {
  void requestNotificationPermission();

  if (schedulerTimer !== null) {
    window.clearInterval(schedulerTimer);
  }

  // Initial check
  checkTaskReminders(getTasks());

  // Periodical check every 15 seconds
  schedulerTimer = window.setInterval(() => {
    checkTaskReminders(getTasks());
  }, 15000);

  return () => {
    if (schedulerTimer !== null) {
      window.clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  };
}
