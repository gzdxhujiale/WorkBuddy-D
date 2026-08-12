import { supabase } from "@/lib/supabase";
import { Habit, HabitCheckIn, HabitData } from "@/types/habit";
import { HabitRow, HabitCheckinRow } from "@/types/database";
import { throwOnPostgrestError } from "@/lib/sync";
import { userStorageKey } from "@/lib/userStorage";

const LOCAL_STORAGE_HABITS_KEY = "fishbuddy_habits_v1";
const LOCAL_STORAGE_CHECKINS_KEY = "fishbuddy_habit_checkins_v1";

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

function getLocalData(): HabitData {
  try {
    const rawHabits = localStorage.getItem(userStorageKey(LOCAL_STORAGE_HABITS_KEY));
    const rawCheckins = localStorage.getItem(userStorageKey(LOCAL_STORAGE_CHECKINS_KEY));
    return {
      habits: rawHabits ? JSON.parse(rawHabits) : [],
      checkIns: rawCheckins ? JSON.parse(rawCheckins) : [],
    };
  } catch {
    return { habits: [], checkIns: [] };
  }
}

function saveLocalData(data: HabitData): void {
  try {
    localStorage.setItem(userStorageKey(LOCAL_STORAGE_HABITS_KEY), JSON.stringify(data.habits));
    localStorage.setItem(userStorageKey(LOCAL_STORAGE_CHECKINS_KEY), JSON.stringify(data.checkIns));
  } catch (e) {
    console.error("Failed to save local habit data:", e);
  }
}

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
          .order("date", { ascending: false }),
      ]);

      if (habitsRes.error || checkInsRes.error) {
        console.warn("Supabase habits load warning, using local cache:", habitsRes.error?.message || checkInsRes.error?.message);
        return getLocalData();
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
      saveLocalData(result);
      return result;
    } catch (err) {
      console.warn("Using local storage fallback for habits load exception:", err);
    }

    return getLocalData();
  },

  createHabit: async (habit: Habit): Promise<number> => {
    // 1. Local update
    const current = getLocalData();
    current.habits.push(habit);
    saveLocalData(current);

    const { data, error } = await saveHabit(habit);
    throwOnPostgrestError(error, "创建习惯");
    return new Date(data as string).getTime();
  },

  updateHabit: async (habit: Habit): Promise<number> => {
    // 1. Local update
    const current = getLocalData();
    const idx = current.habits.findIndex((h) => h.id === habit.id);
    if (idx >= 0) {
      current.habits[idx] = habit;
      saveLocalData(current);
    }

    const { data, error } = await saveHabit(habit);
    throwOnPostgrestError(error, "更新习惯");
    return new Date(data as string).getTime();
  },

  deleteHabit: async (id: string): Promise<void> => {
    // 1. Local update
    const current = getLocalData();
    current.habits = current.habits.filter((h) => h.id !== id);
    current.checkIns = current.checkIns.filter((c) => c.habitId !== id);
    saveLocalData(current);

    // 2. Supabase Soft Delete
    const nowStr = new Date().toISOString();
    const [habitResult, checkInResult] = await Promise.all([
        supabase.from("habits").update({ deleted_at: nowStr }).eq("id", id),
        supabase.from("habit_checkins").update({ deleted_at: nowStr }).eq("habit_id", id),
    ]);
    throwOnPostgrestError(habitResult.error || checkInResult.error, "删除习惯");
  },

  toggleCheckIn: async (habitId: string, date: string, completed: boolean): Promise<void> => {
    // 1. Local update
    const current = getLocalData();
    const idx = current.checkIns.findIndex((c) => c.habitId === habitId && c.date === date);
    if (idx >= 0) {
      current.checkIns[idx] = { ...current.checkIns[idx], completed, updatedAt: Date.now() };
    } else {
      current.checkIns.push({
        id: crypto.randomUUID(),
        habitId,
        date,
        completed,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    saveLocalData(current);

    // 2. Supabase Upsert
    const payload: Partial<HabitCheckinRow> = {
        habit_id: habitId,
        date,
        completed,
        updated_at: new Date().toISOString(),
      };

    const { error } = await supabase.from("habit_checkins").upsert(payload, {
      onConflict: "user_id,habit_id,date",
    });
    throwOnPostgrestError(error, "保存习惯打卡");
  },
};
