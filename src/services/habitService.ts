import { supabase } from "@/lib/supabase";
import { Habit, HabitCheckIn, HabitData } from "@/types/habit";
import { HabitRow, HabitCheckinRow } from "@/types/database";
import { throwOnPostgrestError } from "@/lib/sync";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";

const CHECKIN_HISTORY_MONTHS = 12;

function checkInHistoryStartDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - CHECKIN_HISTORY_MONTHS);
  return date.toISOString().slice(0, 10);
}

function saveHabit(habit: Habit) {
  return supabase.rpc("save_habit", {
    p_id: habit.id,
    p_name: habit.name,
    p_frequency_type: habit.frequencyType,
    p_frequency_days: habit.frequencyDays,
    p_goal: habit.goal || null,
    p_start_date: habit.startDate || null,
    p_duration: habit.duration || null,
    p_category: habit.category || null,
    p_reminder: habit.checkInTime || habit.reminder || null,
    p_auto_popup_log: habit.autoPopupLog,
    p_sort_order: habit.sortOrder,
    p_created_at: new Date(habit.createdAt).toISOString(),
    p_expected_updated_at: habit.baseUpdatedAt ? new Date(habit.baseUpdatedAt).toISOString() : null,
    p_next_updated_at: new Date(habit.updatedAt).toISOString(),
  });
}
registerOfflineExecutor("habit:save", async (payload) => {
  const { error } = await saveHabit(payload as Habit);
  throwOnPostgrestError(error, "保存习惯");
});
registerOfflineExecutor("habit:delete", async (payload) => {
  const id = payload as string;
  const nowStr = new Date().toISOString();
  const [habitResult, checkInResult] = await Promise.all([
    supabase.from("habits").update({ deleted_at: nowStr }).eq("id", id),
    supabase.from("habit_checkins").update({ deleted_at: nowStr }).eq("habit_id", id),
  ]);
  throwOnPostgrestError(habitResult.error || checkInResult.error, "删除习惯");
});

export const habitApi = {
  loadAll: async (): Promise<HabitData> => {
    try {
      const [habitsRes, checkInsRes] = await Promise.all([
        supabase
          .from("habits")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("habit_checkins")
          .select("*")
          .is("deleted_at", null)
          .gte("date", checkInHistoryStartDate())
          .order("date", { ascending: false }),
      ]);

      if (habitsRes.error || checkInsRes.error) {
        throwOnPostgrestError(habitsRes.error || checkInsRes.error, "加载习惯");
      }

      const habits: Habit[] = (habitsRes.data || []).map((r: HabitRow) => ({
        id: r.id,
        name: r.name,
        frequencyType: (r.frequency_type as "daily" | "weekly_days" | "custom") || "daily",
        frequencyDays: r.frequency_days,
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
        baseUpdatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
      }));

      const checkIns: HabitCheckIn[] = (checkInsRes.data || []).map((c: HabitCheckinRow) => ({
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

  createHabit: async (habit: Habit): Promise<number | undefined> => {
    return runOrQueue({ kind: "habit:save", key: `habit:${habit.id}`, payload: habit }, async () => {
      const { data, error } = await saveHabit(habit);
      throwOnPostgrestError(error, "创建习惯");
      return new Date(data as string).getTime();
    });
  },

  updateHabit: async (habit: Habit): Promise<number | undefined> => {
    return runOrQueue({ kind: "habit:save", key: `habit:${habit.id}`, payload: habit }, async () => {
      const { data, error } = await saveHabit(habit);
      throwOnPostgrestError(error, "更新习惯");
      return new Date(data as string).getTime();
    });
  },

  deleteHabit: async (id: string): Promise<void> => {
    await runOrQueue({ kind: "habit:delete", key: `habit:${id}`, payload: id }, async () => {
      const nowStr = new Date().toISOString();
      const [habitResult, checkInResult] = await Promise.all([
        supabase.from("habits").update({ deleted_at: nowStr }).eq("id", id),
        supabase.from("habit_checkins").update({ deleted_at: nowStr }).eq("habit_id", id),
      ]);
      throwOnPostgrestError(habitResult.error || checkInResult.error, "删除习惯");
    });
  },

  toggleCheckIn: async (habitId: string, date: string, completed: boolean): Promise<void> => {
    const payload: Partial<HabitCheckinRow> = {
        habit_id: habitId,
        date,
        completed,
        updated_at: new Date().toISOString(),
      };

    await runOrQueue({ kind: "habit-checkin:save", key: `habit-checkin:${habitId}:${date}`, payload }, async () => {
      const { error } = await supabase.from("habit_checkins").upsert(payload, {
        onConflict: "user_id,habit_id,date",
      });
      throwOnPostgrestError(error, "保存习惯打卡");
    });
  },
};

registerOfflineExecutor("habit-checkin:save", async (payload) => {
  const { error } = await supabase.from("habit_checkins").upsert(payload as Partial<HabitCheckinRow>, {
    onConflict: "user_id,habit_id,date",
  });
  throwOnPostgrestError(error, "保存习惯打卡");
});
