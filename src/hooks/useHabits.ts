import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { habitApi } from "@/services/habitService";
import { Habit, HabitData } from "@/types/habit";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import { queryKeys } from "@/lib/syncEngine";
import { useAuth } from "@/lib/auth";
import { createHabitId } from "@/lib/entityIds";

export function useHabitData() {
  const { userId } = useAuth();
  const queryKey = queryKeys.habits(userId);
  return useQuery({
    queryKey,
    queryFn: () => habitApi.loadAll(),
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}

export function useHabitActions() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const HABITS_QUERY_KEY = queryKeys.habits(userId);
  // Create Habit Sync
  const { trigger: triggerCreate } = useOptimisticSync<HabitData, Habit>({
    queryKey: HABITS_QUERY_KEY,
    debounceMs: 0,
    updateCache: (old, newHabit) => {
      const current = old ?? { habits: [], checkIns: [] };
      return {
        ...current,
        habits: [...current.habits, newHabit],
      };
    },
    syncFn: async (newHabit) => {
      const savedUpdatedAt = await habitApi.createHabit(newHabit);
      if (savedUpdatedAt === undefined) return;
      queryClient.setQueryData<HabitData>(HABITS_QUERY_KEY, (old) => old ? {
        ...old, habits: old.habits.map((item) => item.id === newHabit.id && item.updatedAt === newHabit.updatedAt
          ? { ...item, updatedAt: savedUpdatedAt.updatedAt, baseUpdatedAt: savedUpdatedAt.updatedAt, lockVersion: savedUpdatedAt.lockVersion, isNew: false } : item),
      } : old);
    },
    getSyncKey: (habit) => habit.id,
  });

  // Update Habit Sync
  const { trigger: triggerUpdate } = useOptimisticSync<
    HabitData,
    { id: string; updates: Partial<Habit> }
  >({
    queryKey: HABITS_QUERY_KEY,
    debounceMs: 300,
    updateCache: (old, { id, updates }) => {
      const current = old ?? { habits: [], checkIns: [] };
      const habits = current.habits.map((h) => h.id === id
        ? { ...h, ...updates, updatedAt: Date.now(), baseUpdatedAt: h.baseUpdatedAt } : h);
      return { ...current, habits };
    },
    syncFn: async ({ id }) => {
      const habit = queryClient.getQueryData<HabitData>(HABITS_QUERY_KEY)?.habits.find((item) => item.id === id);
      if (!habit) return;
      const savedUpdatedAt = await habitApi.updateHabit(habit);
      if (savedUpdatedAt === undefined) return;
      queryClient.setQueryData<HabitData>(HABITS_QUERY_KEY, (old) => old ? {
        ...old, habits: old.habits.map((item) => item.id === habit.id && item.updatedAt === habit.updatedAt
          ? { ...item, updatedAt: savedUpdatedAt.updatedAt, baseUpdatedAt: savedUpdatedAt.updatedAt, lockVersion: savedUpdatedAt.lockVersion, isNew: false } : item),
      } : old);
    },
    getSyncKey: ({ id }) => id,
  });

  // Delete Habit Sync
  const { trigger: triggerDelete } = useOptimisticSync<HabitData, Pick<Habit, "id" | "lockVersion">>({
    queryKey: HABITS_QUERY_KEY,
    debounceMs: 0,
    updateCache: (old, { id }) => {
      const current = old ?? { habits: [], checkIns: [] };
      return {
        habits: current.habits.filter((h) => h.id !== id),
        checkIns: current.checkIns.filter((c) => c.habitId !== id),
      };
    },
    syncFn: async (habit) => {
      await habitApi.deleteHabit(habit);
    },
    getSyncKey: ({ id }) => id,
  });

  // Toggle CheckIn Sync (0ms instant toggle)
  const { trigger: triggerToggleCheckIn } = useOptimisticSync<
    HabitData,
    { habitId: string; date: string; completed: boolean }
  >({
    queryKey: HABITS_QUERY_KEY,
    debounceMs: 0,
    updateCache: (old, { habitId, date, completed }) => {
      const current = old ?? { habits: [], checkIns: [] };
      const idx = current.checkIns.findIndex((c) => c.habitId === habitId && c.date === date);
      const checkIns = [...current.checkIns];
      if (idx >= 0) {
        checkIns[idx] = { ...checkIns[idx], completed, updatedAt: Date.now() };
      } else {
        checkIns.push({
          id: "temp-" + Date.now(),
          habitId,
          date,
          completed,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      return { ...current, checkIns };
    },
    syncFn: async ({ habitId, date, completed }) => {
      await habitApi.toggleCheckIn(habitId, date, completed);
    },
    getSyncKey: ({ habitId, date }) => `${habitId}:${date}`,
  });

  const createHabit = useCallback(
    (payload: Partial<Habit>): Habit => {
      const now = Date.now();
      const newHabit: Habit = {
        id: createHabitId(),
        name: payload.name || "未命名习惯",
        frequencyType: payload.frequencyType || "daily",
        goal: payload.goal || "today",
        startDate: payload.startDate || undefined,
        duration: payload.duration || "30days",
        category: payload.category || "body",
        reminder: payload.reminder || undefined,
        autoPopupLog: payload.autoPopupLog || false,
        checkInTime: payload.checkInTime || "08:00:00",
        sortOrder: payload.sortOrder || 0,
        createdAt: now,
        updatedAt: now,
      };

      triggerCreate(newHabit);
      return newHabit;
    },
    [triggerCreate]
  );

  const updateHabit = useCallback(
    (id: string, updates: Partial<Habit>) => {
      triggerUpdate({ id, updates });
    },
    [triggerUpdate]
  );

  const deleteHabit = useCallback(
    (id: string) => {
      const habit = queryClient.getQueryData<HabitData>(HABITS_QUERY_KEY)?.habits.find((item) => item.id === id);
      if (habit) triggerDelete(habit);
    },
    [HABITS_QUERY_KEY, queryClient, triggerDelete]
  );

  const toggleCheckIn = useCallback(
    (habitId: string, date: string, completed: boolean) => {
      triggerToggleCheckIn({ habitId, date, completed });
    },
    [triggerToggleCheckIn]
  );

  return {
    createHabit,
    updateHabit,
    deleteHabit,
    toggleCheckIn,
  };
}
