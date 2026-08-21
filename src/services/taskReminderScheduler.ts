import dayjs from "dayjs";
import { emit, listen } from "@tauri-apps/api/event";
import { Task, parseReminder, TaskReminder } from "@/types/timeManagement";
import { sendDesktopNotification, requestNotificationPermission } from "./notificationService";
import { playTaskReminderSound } from "@/lib/soundFeedback";
import { getAppThemeStyle } from "@/lib/preferences";

const notifiedTasks = new Set<string>();
const snoozedTasks = new Map<string, number>();
const NOTIFIED_STORAGE_KEY = "workbuddy_task_reminders_v1";
const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2147483647; // 32-bit signed int max (~24.8 days)

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

export function snoozeTaskReminder(taskId: string, snoozeMinutes = 5): void {
  const snoozeUntil = Date.now() + snoozeMinutes * 60 * 1000;
  snoozedTasks.set(taskId, snoozeUntil);

  for (const key of Array.from(notifiedTasks)) {
    if (key.startsWith(`${taskId}-`)) {
      notifiedTasks.delete(key);
    }
  }
  try {
    const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
    const entries = JSON.parse(raw ?? "[]") as Array<[string, number]>;
    const filtered = entries.filter(([k]) => !k.startsWith(`${taskId}-`));
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(filtered));
  } catch {}

  if (currentGetTasks) {
    checkTaskReminders(currentGetTasks());
  }
}

export function getTaskTargetDate(task: Task): dayjs.Dayjs {
  if (task.scheduledEndAt) return dayjs(task.scheduledEndAt);
  if (task.scheduledStartAt) return dayjs(task.scheduledStartAt);
  return dayjs(task.createdAt);
}

export function computeTaskReminderTime(task: Task): number | null {
  if (task.completed) return null;

  const snoozedUntil = snoozedTasks.get(task.id);
  if (snoozedUntil) {
    if (Date.now() < snoozedUntil) {
      return snoozedUntil;
    }
    snoozedTasks.delete(task.id);
  }

  const rem: TaskReminder | null = parseReminder(task.reminder);
  if (!rem) return null;

  const targetDate = getTaskTargetDate(task).subtract(rem.offsetDays, "day");
  const [h, m] = (rem.time || "09:00").split(":").map(Number);
  const baseRemTime = targetDate.hour(h).minute(m).second(0).millisecond(0).valueOf();

  if (rem.repeat) {
    const todayRem = dayjs().hour(h).minute(m).second(0).millisecond(0).valueOf();
    if (todayRem >= baseRemTime) {
      return todayRem;
    }
  }

  return baseRemTime;
}


let nextDueTimer: number | null = null;
let heartbeatTimer: number | null = null;
let currentGetTasks: (() => Task[]) | null = null;

/**
 * Executes due reminders and accurately arms the single next-event timer.
 */
export function checkTaskReminders(tasks: Task[]): void {
  const now = Date.now();
  const persistedNotified = readNotifiedTasks();
  const upcomingTimes: number[] = [];

  tasks.forEach((task) => {
    if (task.completed) return;

    const remTime = computeTaskReminderTime(task);
    if (!remTime) return;

    const rem = parseReminder(task.reminder);
    const key = rem?.repeat
      ? `${task.id}-${dayjs(now).format("YYYY-MM-DD")}-${remTime}`
      : `${task.id}-${remTime}`;

    if (notifiedTasks.has(key) || persistedNotified.has(key)) {
      return;
    }

    // A reminder is due if now >= remTime
    if (now >= remTime) {
      markNotified(key);

      const dateText = dayjs(remTime).format("M月D日 HH:mm");
      const title = `⏰ 任务提醒`;
      const body = `「${task.title}」已到提醒时间（${dateText}）`;

      const isPixel = getAppThemeStyle() === "retro-pixel";

      // 1. Play synthesized audio feedback
      void playTaskReminderSound(isPixel);

      // 2. Multi-monitor Custom Webview Window Notification Toast
      void sendDesktopNotification(title, body, {
        eventType: "task_reminder",
        taskId: task.id,
        themeStyle: isPixel ? "pixel" : "modern",
      });

      // 3. Broadcast to Focus Assistant companion & other webviews via Tauri IPC
      void emit("workbuddy:task-reminder", {
        taskId: task.id,
        title: task.title,
        body,
        dateText,
        quadrant: task.quadrant,
        remTime,
      });
    } else {
      upcomingTimes.push(remTime);
    }
  });

  // Clear previous next-event timer and schedule the single earliest upcoming reminder
  if (nextDueTimer !== null) {
    window.clearTimeout(nextDueTimer);
    nextDueTimer = null;
  }

  if (upcomingTimes.length > 0) {
    const earliestTime = Math.min(...upcomingTimes);
    const delay = Math.max(0, Math.min(earliestTime - Date.now(), MAX_TIMEOUT_MS));
    nextDueTimer = window.setTimeout(() => {
      if (currentGetTasks) {
        checkTaskReminders(currentGetTasks());
      }
    }, delay);
  }
}

/**
 * Starts the hybrid task reminder scheduler:
 * 1. Immediate check & dynamic next-event exact timer (0-delay, 0-CPU-waste)
 * 2. 60-second background drift guard (handles clock jumps / timezone changes)
 * 3. Visibility and focus listeners (compensates for OS sleep / screen-lock resume)
 */
export function startTaskReminderScheduler(getTasks: () => Task[]): () => void {
  void requestNotificationPermission();
  currentGetTasks = getTasks;

  if (nextDueTimer !== null) {
    window.clearTimeout(nextDueTimer);
    nextDueTimer = null;
  }
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // 1. Initial check and arm next-event timer
  checkTaskReminders(getTasks());

  // 2. Low-frequency 60s background drift & sleep recovery guard
  heartbeatTimer = window.setInterval(() => {
    if (currentGetTasks) {
      checkTaskReminders(currentGetTasks());
    }
  }, 60000);

  // 3. Immediate check on wake / window focus
  const onWakeOrFocus = () => {
    if (currentGetTasks) {
      checkTaskReminders(currentGetTasks());
    }
  };

  let unlistenSnooze: (() => void) | undefined;
  listen<{ taskId: string; snoozeMinutes?: number }>("workbuddy:snooze-task-reminder", (event) => {
    if (event.payload?.taskId) {
      snoozeTaskReminder(event.payload.taskId, event.payload.snoozeMinutes || 5);
    }
  }).then((un) => {
    unlistenSnooze = un;
  }).catch(() => {});

  if (typeof window !== "undefined") {
    window.addEventListener("visibilitychange", onWakeOrFocus);
    window.addEventListener("focus", onWakeOrFocus);
  }

  return () => {
    if (nextDueTimer !== null) {
      window.clearTimeout(nextDueTimer);
      nextDueTimer = null;
    }
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (unlistenSnooze) {
      unlistenSnooze();
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("visibilitychange", onWakeOrFocus);
      window.removeEventListener("focus", onWakeOrFocus);
    }
    currentGetTasks = null;
  };
}

