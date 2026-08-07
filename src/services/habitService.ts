import { supabase } from "@/lib/supabase";
import { Habit, HabitCheckIn, HabitData } from "@/types/habit";
import { HabitRow, HabitCheckinRow } from "@/types/database";

const LOCAL_STORAGE_HABITS_KEY = "fishbuddy_habits_v1";
const LOCAL_STORAGE_CHECKINS_KEY = "fishbuddy_habit_checkins_v1";

function getLocalData(): HabitData {
  try {
    const rawHabits = localStorage.getItem(LOCAL_STORAGE_HABITS_KEY);
    const rawCheckins = localStorage.getItem(LOCAL_STORAGE_CHECKINS_KEY);
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
    localStorage.setItem(LOCAL_STORAGE_HABITS_KEY, JSON.stringify(data.habits));
    localStorage.setItem(LOCAL_STORAGE_CHECKINS_KEY, JSON.stringify(data.checkIns));
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

      if (habitsRes.error) {
        console.warn("Supabase habits load warning, using local cache:", habitsRes.error.message);
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

  createHabit: async (habit: Habit): Promise<void> => {
    // 1. Local update
    const current = getLocalData();
    current.habits.push(habit);
    saveLocalData(current);

    // 2. Supabase Insert
    try {
      const payload: Partial<HabitRow> = {
        id: habit.id,
        name: habit.name,
        frequency_type: habit.frequencyType,
        frequency_days: habit.frequencyDays,
        goal: habit.goal || null,
        start_date: habit.startDate || null,
        duration: habit.duration || null,
        category: habit.category || null,
        reminder: habit.checkInTime || habit.reminder || null,
        auto_popup_log: habit.autoPopupLog,
        sort_order: habit.sortOrder,
        created_at: new Date(habit.createdAt).toISOString(),
        updated_at: new Date(habit.updatedAt).toISOString(),
      };

      const { error } = await supabase.from("habits").insert(payload);
      if (error) {
        console.warn("Supabase create habit warning:", error.message);
      }
    } catch (e) {
      console.warn("Supabase create habit exception:", e);
    }
  },

  updateHabit: async (id: string, updates: Partial<Habit>): Promise<void> => {
    // 1. Local update
    const current = getLocalData();
    const idx = current.habits.findIndex((h) => h.id === id);
    if (idx >= 0) {
      current.habits[idx] = { ...current.habits[idx], ...updates, updatedAt: Date.now() };
      saveLocalData(current);
    }

    // 2. Supabase Update
    try {
      const payload: Partial<HabitRow> = {
        ...(updates.name && { name: updates.name }),
        ...(updates.frequencyType && { frequency_type: updates.frequencyType }),
        ...(updates.frequencyDays !== undefined && { frequency_days: updates.frequencyDays }),
        ...(updates.goal !== undefined && { goal: updates.goal }),
        ...(updates.startDate !== undefined && { start_date: updates.startDate }),
        ...(updates.duration !== undefined && { duration: updates.duration }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.checkInTime !== undefined && { reminder: updates.checkInTime }),
        ...(updates.autoPopupLog !== undefined && { auto_popup_log: updates.autoPopupLog }),
        ...(updates.sortOrder !== undefined && { sort_order: updates.sortOrder }),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("habits").update(payload).eq("id", id);
      if (error) {
        console.warn("Supabase update habit warning:", error.message);
      }
    } catch (e) {
      console.warn("Supabase update habit exception:", e);
    }
  },

  deleteHabit: async (id: string): Promise<void> => {
    // 1. Local update
    const current = getLocalData();
    current.habits = current.habits.filter((h) => h.id !== id);
    current.checkIns = current.checkIns.filter((c) => c.habitId !== id);
    saveLocalData(current);

    // 2. Supabase Soft Delete
    try {
      const nowStr = new Date().toISOString();
      await Promise.all([
        supabase.from("habits").update({ deleted_at: nowStr }).eq("id", id),
        supabase.from("habit_checkins").update({ deleted_at: nowStr }).eq("habit_id", id),
      ]);
    } catch (e) {
      console.warn("Supabase delete habit exception:", e);
    }
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
    try {
      const payload: Partial<HabitCheckinRow> = {
        habit_id: habitId,
        date,
        completed,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("habit_checkins").upsert(payload, {
        onConflict: "user_id,habit_id,date",
      });

      if (error) {
        console.warn("Supabase toggle check-in warning:", error.message);
      }
    } catch (e) {
      console.warn("Supabase toggle check-in exception:", e);
    }
  },
};
