import { apiClient } from "@/lib/apiClient";
import { Habit, HabitCheckIn, HabitData } from "../types";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";
import { formatDateYMD } from "@/lib/dateUtils";

export type SavedHabitVersion = { updatedAt: number; lockVersion: number };

function formatDateString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      return val.slice(0, 10);
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return formatDateYMD(parsed);
    }
    return val;
  }
  if (typeof val === "number" || val instanceof Date) {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return formatDateYMD(parsed);
    }
  }
  return "";
}

async function saveHabit(habit: Habit): Promise<SavedHabitVersion> {
  const payload = {
    id: habit.id,
    name: habit.name,
    frequency_type: habit.frequencyType,
    goal: habit.goal || null,
    start_date: habit.startDate || null,
    duration: habit.duration || null,
    category: habit.category || null,
    reminder: habit.reminder || habit.checkInTime || null,
    auto_popup_log: habit.autoPopupLog,
    sort_order: habit.sortOrder,
    lock_version: habit.lockVersion ?? 1,
  };

  let saved: { updated_at?: string; lock_version?: number };
  if (habit.lockVersion) {
    saved = await apiClient.put(`/api/v1/habits/${habit.id}`, payload);
  } else {
    saved = await apiClient.post(`/api/v1/habits`, payload);
  }
  return {
    updatedAt: saved.updated_at ? new Date(saved.updated_at).getTime() : Date.now(),
    lockVersion: Number(saved.lock_version || 1),
  };
}

registerOfflineExecutor("habit:save", async (payload) => {
  await saveHabit(payload as Habit);
});
registerOfflineExecutor("habit:delete", async (payload) => {
  const habit = payload as Pick<Habit, "id" | "lockVersion">;
  await apiClient.delete(`/api/v1/habits/${habit.id}`);
});

export const habitApi = {
  loadAll: async (): Promise<HabitData> => {
    const [habitsRes, checkinsRes] = await Promise.all([
      apiClient.get<Array<Record<string, unknown>>>("/api/v1/habits"),
      apiClient.get<Array<Record<string, unknown>>>("/api/v1/habits/checkins"),
    ]);

    const habits: Habit[] = (habitsRes || []).map((r) => {
      const reminderStr = (r.reminder as string) || undefined;
      return {
        id: r.id as string,
        name: r.name as string,
        frequencyType: (r.frequency_type as "daily" | "weekly_days" | "custom") || "daily",
        goal: (r.goal as string) || undefined,
        startDate: r.start_date ? formatDateString(r.start_date) : undefined,
        duration: (r.duration as string) || undefined,
        category: (r.category as string) || undefined,
        reminder: reminderStr,
        autoPopupLog: Boolean(r.auto_popup_log),
        checkInTime: reminderStr || "08:00:00",
        sortOrder: Number(r.sort_order || 0),
        createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
        updatedAt: r.updated_at ? new Date(r.updated_at as string).getTime() : Date.now(),
        lockVersion: Number(r.lock_version || 1),
      };
    });

    const checkIns: HabitCheckIn[] = (checkinsRes || []).map((c) => ({
      id: c.id as string,
      habitId: (c.habit_id || c.habitId) as string,
      date: formatDateString(c.date),
      completed: Boolean(c.completed),
      createdAt: c.created_at ? new Date(c.created_at as string).getTime() : Date.now(),
      updatedAt: c.updated_at ? new Date(c.updated_at as string).getTime() : Date.now(),
    }));

    return { habits, checkIns };
  },

  createHabit: async (habit: Habit): Promise<SavedHabitVersion | undefined> => {
    return runOrQueue({ kind: "habit:save", key: `habit:${habit.id}`, payload: habit }, async () => {
      return saveHabit(habit);
    });
  },

  updateHabit: async (habit: Habit): Promise<SavedHabitVersion | undefined> => {
    return runOrQueue({ kind: "habit:save", key: `habit:${habit.id}`, payload: habit }, async () => {
      return saveHabit(habit);
    });
  },

  deleteHabit: async (habit: Pick<Habit, "id" | "lockVersion">): Promise<void> => {
    await runOrQueue({ kind: "habit:delete", key: `habit:${habit.id}`, payload: habit }, async () => {
      await apiClient.delete(`/api/v1/habits/${habit.id}`);
    });
  },

  toggleCheckIn: async (habitId: string, date: string, completed: boolean): Promise<void> => {
    const payload = { habitId, date, completed };
    await runOrQueue({ kind: "habit-checkin:save", key: `habit-checkin:${habitId}:${date}`, payload }, async () => {
      await apiClient.post("/api/v1/habits/checkin", {
        habit_id: habitId,
        date,
        completed,
      });
    });
  },
};

registerOfflineExecutor("habit-checkin:save", async (payload) => {
  const checkIn = payload as { habitId: string; date: string; completed: boolean };
  await apiClient.post("/api/v1/habits/checkin", {
    habit_id: checkIn.habitId,
    date: checkIn.date,
    completed: checkIn.completed,
  });
});
