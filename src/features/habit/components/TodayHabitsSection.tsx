import React, { useMemo } from "react";
import { Flame } from "lucide-react";
import { useHabitData, useHabitActions } from "../hooks/useHabits";
import { todayYMD } from "@/lib/dateUtils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelFlame } from "@/components/pixel/PixelIcons";
import { cn } from "@/lib/utils";
import {
  getHabitsForDate,
  getCheckInStatus,
  getHabitStreak,
} from "../utils/habitSelectors";

export const TodayHabitsSection: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const today = todayYMD();

  const { data: habitData } = useHabitData();
  const { toggleCheckIn } = useHabitActions();
  const habits = useMemo(() => habitData?.habits ?? [], [habitData]);
  const checkIns = useMemo(() => habitData?.checkIns ?? [], [habitData]);

  const todayHabits = useMemo(() => getHabitsForDate(habits, today), [habits, today]);
  const checkedHabits = useMemo(
    () => todayHabits.filter((h) => getCheckInStatus(checkIns, h.id, today)),
    [todayHabits, checkIns, today]
  );

  const maxHabitStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return habits.reduce((max, h) => Math.max(max, getHabitStreak(checkIns, h.id)), 0);
  }, [habits, checkIns]);

  return (
    <div
      className={cn(
        "flex-1 bg-card p-3 flex flex-col justify-between overflow-hidden",
        isPixelTheme
          ? "border-2 border-border/90 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
          : "border border-border rounded-xl shadow-2xs"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          {isPixelTheme ? <PixelFlame size={14} /> : <Flame size={14} className="text-amber-500" />}
          <span>{isPixelTheme ? "每日修行历练" : "习惯追踪打卡"}</span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
          {todayHabits.length > 0
            ? `${checkedHabits.length}/${todayHabits.length} 已完成`
            : "今日无习惯"}
        </span>
      </div>

      {/* Habit Items Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
        {todayHabits.length === 0 ? (
          <span className="text-xs text-muted-foreground italic py-1">暂无打卡习惯</span>
        ) : (
          todayHabits.map((habit) => {
            const isDone = getCheckInStatus(checkIns, habit.id, today);
            return (
              <button
                key={habit.id}
                type="button"
                onClick={() => toggleCheckIn(habit.id, today, !isDone)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-all cursor-pointer shrink-0 border select-none",
                  isPixelTheme ? "rounded-xs" : "rounded-lg",
                  isDone
                    ? isPixelTheme
                      ? "bg-emerald-100/90 text-emerald-900 border-emerald-700/60 shadow-[1px_1px_0px_#064e3b] dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs"
                    : isPixelTheme
                      ? "bg-muted/40 text-muted-foreground border-border hover:border-emerald-600 hover:text-foreground"
                      : "bg-muted/30 text-muted-foreground border-border hover:border-emerald-500 hover:text-foreground"
                )}
              >
                <span className={cn("size-2 rounded-full", isDone ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")} />
                <span>{habit.name}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Continuous Streak Indicator */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-1.5">
        <span>最高连续打卡</span>
        <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
          🔥 {maxHabitStreak} 天连胜
        </span>
      </div>
    </div>
  );
};
