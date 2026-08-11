import dayjs from "dayjs";
import { Task, parseReminder, TaskReminder } from "@/types/timeManagement";
import { sendDesktopNotification, requestNotificationPermission } from "./notificationService";

const notifiedTasks = new Set<string>();

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

  tasks.forEach((task) => {
    if (task.completed) return;

    const remTime = computeTaskReminderTime(task);
    if (!remTime) return;

    const key = `${task.id}-${remTime}`;
    // If reminder time reached (within 2-minute window and not yet notified)
    if (now >= remTime && now - remTime <= 120 * 1000 && !notifiedTasks.has(key)) {
      notifiedTasks.add(key);

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
