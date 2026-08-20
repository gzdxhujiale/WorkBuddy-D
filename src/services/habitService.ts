import { supabase } from "@/lib/supabase";
import { Habit, HabitCheckIn, HabitData } from "@/types/habit";
import { throwOnPostgrestError } from "@/lib/sync";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";

const CHECKIN_HISTORY_MONTHS = 12;

function checkInHistoryStartDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - CHECKIN_HISTORY_MONTHS);
  return date.toISOString().slice(0, 10);
}

export type SavedHabitVersion = { updatedAt: number; lockVersion: number };

async function saveHabit(habit: Habit): Promise<SavedHabitVersion> {
  const { data, error } = await supabase.rpc("save_habit_v2", {
    p_id: habit.id,
    p_name: habit.name,
    p_frequency_type: habit.frequencyType,
    p_goal: habit.goal || null,
    p_start_date: habit.startDate || null,
    p_duration: habit.duration || null,
    p_category: habit.category || null,
    p_reminder: habit.checkInTime || habit.reminder || null,
    p_auto_popup_log: habit.autoPopupLog,
    p_sort_order: habit.sortOrder,
    p_expected_lock_version: habit.lockVersion ?? null,
  });
  throwOnPostgrestError(error, "保存习惯");
  const saved = (data as Array<{ updated_at: string; lock_version: number }>)[0];
  return { updatedAt: new Date(saved.updated_at).getTime(), lockVersion: Number(saved.lock_version) };
}
registerOfflineExecutor("habit:save", async (payload) => {
  await saveHabit(payload as Habit);
});
registerOfflineExecutor("habit:delete", async (payload) => {
  const habit = payload as Pick<Habit, "id" | "lockVersion">;
  if (habit.lockVersion === undefined) throw new Error("习惯版本尚未加载，已阻止非条件删除");
  const { error } = await supabase.rpc("soft_delete_habit_v3", { p_id: habit.id, p_expected_lock_version: habit.lockVersion });
  throwOnPostgrestError(error, "删除习惯");
});

export const habitApi = {
  loadAll: async (): Promise<HabitData> => {
    try {
      const [habitsRes, checkInsRes] = await Promise.all([
        supabase
          .from("habits")
          .select("id,name,frequency_type,goal,start_date,duration,category,reminder,auto_popup_log,sort_order,created_at,updated_at,lock_version")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("habit_checkins")
          .select("id,habit_id,date,completed,created_at,updated_at")
          .is("deleted_at", null)
          .gte("date", checkInHistoryStartDate())
          .order("date", { ascending: false }),
      ]);

      if (habitsRes.error || checkInsRes.error) {
        throwOnPostgrestError(habitsRes.error || checkInsRes.error, "加载习惯");
      }

      const habits: Habit[] = (habitsRes.data || []).map((r) => ({
        id: r.id,
        name: r.name,
        frequencyType: (r.frequency_type as "daily" | "weekly_days" | "custom") || "daily",
        goal: r.goal || undefined,
        startDate: r.start_date || undefined,
        duration: r.duration || undefined,
        category: r.category || undefined,
        reminder: r.reminder || undefined,
        autoPopupLog: r.auto_popup_log,
        checkInTime: r.reminder || "08:00:00",
        sortOrder: r.sort_order,
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
        lockVersion: Number(r.lock_version),
        baseUpdatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
      }));

      const checkIns: HabitCheckIn[] = (checkInsRes.data || []).map((c) => ({
        id: c.id,
        habitId: c.habit_id,
        date: c.date,
        completed: c.completed,
        createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
        updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
      }));

      const result: HabitData = { habits, checkIns };
      return result;
    } catch (err) {
      throw err;
    }

    return { habits: [], checkIns: [] };
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
    if (habit.lockVersion === undefined) throw new Error("习惯版本尚未加载，已阻止非条件删除");
    await runOrQueue({ kind: "habit:delete", key: `habit:${habit.id}`, payload: habit }, async () => {
      const { error } = await supabase.rpc("soft_delete_habit_v3", { p_id: habit.id, p_expected_lock_version: habit.lockVersion });
      throwOnPostgrestError(error, "删除习惯");
    });
  },

  toggleCheckIn: async (habitId: string, date: string, completed: boolean): Promise<void> => {
  const payload = { habitId, date, completed };

    await runOrQueue({ kind: "habit-checkin:save", key: `habit-checkin:${habitId}:${date}`, payload }, async () => {
      const { error } = await supabase.rpc("save_habit_checkin", {
        p_habit_id: habitId,
        p_date: date,
        p_completed: completed,
      });
      throwOnPostgrestError(error, "保存习惯打卡");
    });
  },
};

registerOfflineExecutor("habit-checkin:save", async (payload) => {
  const checkIn = payload as { habitId: string; date: string; completed: boolean };
  const { error } = await supabase.rpc("save_habit_checkin", {
    p_habit_id: checkIn.habitId,
    p_date: checkIn.date,
    p_completed: checkIn.completed,
  });
  throwOnPostgrestError(error, "保存习惯打卡");
});
