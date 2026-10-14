import { Habit, HabitCheckIn, HabitStats } from "../types";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";

/**
 * 检查指定习惯在特定日期是否已打卡完成
 */
export function getCheckInStatus(
  checkIns: HabitCheckIn[],
  habitId: string,
  dateStr: string
): boolean {
  return checkIns.some(
    (c) => c.habitId === habitId && c.date === dateStr && c.completed
  );
}

/**
 * 计算习惯的连续打卡天数 (Streak)
 * 使用标准日历递减算法，消除夏令时与跨月计算偏差，无 365 天硬编码截断限制
 */
export function getHabitStreak(
  checkIns: HabitCheckIn[],
  habitId: string
): number {
  const completedDates = new Set(
    checkIns
      .filter((c) => c.habitId === habitId && c.completed)
      .map((c) => c.date)
  );

  if (completedDates.size === 0) return 0;

  const today = todayYMD();
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterday = formatDateYMD(yesterdayObj);

  // 如果今天与昨天都未打卡，则连击已经中断
  if (!completedDates.has(today) && !completedDates.has(yesterday)) {
    return 0;
  }

  let streak = 0;
  // 如果今天已打卡，从今天倒推；否则从昨天倒推
  const curObj = new Date();
  if (!completedDates.has(today)) {
    curObj.setDate(curObj.getDate() - 1);
  }

  while (true) {
    const dStr = formatDateYMD(curObj);
    if (completedDates.has(dStr)) {
      streak++;
      curObj.setDate(curObj.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 计算习惯的统计概览（本月打卡数、累计打卡数、本月达成率、当前连击天数）
 */
export function getHabitStats(
  checkIns: HabitCheckIn[],
  habitId: string,
  dateStr: string
): HabitStats {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = (parts[1] || 1) - 1; // 0-indexed

  let totalCheckIns = 0;
  let monthCheckIns = 0;

  for (const c of checkIns) {
    if (c.habitId === habitId && c.completed) {
      totalCheckIns++;
      const [cYear, cMonth] = c.date.split("-").map(Number);
      if (cYear === year && cMonth - 1 === month) {
        monthCheckIns++;
      }
    }
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthlyCompletionRate = daysInMonth > 0
    ? Math.round((monthCheckIns / daysInMonth) * 100)
    : 0;

  return {
    monthCheckIns,
    totalCheckIns,
    monthlyCompletionRate,
    currentStreak: getHabitStreak(checkIns, habitId),
  };
}

/**
 * 根据指定日期筛选处于有效生命周期内的习惯列表
 */
export function getHabitsForDate(habits: Habit[], dateStr: string): Habit[] {
  return habits.filter((habit) => {
    let startDateStr = habit.startDate;
    if (!startDateStr || startDateStr.trim() === "") {
      startDateStr = habit.createdAt
        ? new Date(habit.createdAt).toISOString().slice(0, 10)
        : dateStr;
    }

    // 尚未到达开始日期
    if (dateStr < startDateStr) return false;

    // 检查坚持时长有效性
    if (habit.duration && habit.duration !== "forever") {
      let days = 0;
      if (habit.duration.startsWith("custom:")) {
        days = parseInt(habit.duration.replace("custom:", ""), 10) || 0;
      } else {
        days = parseInt(habit.duration.replace(/[^0-9]/g, ""), 10) || 0;
      }

      if (days > 0) {
        const sParts = startDateStr.split("-").map(Number);
        if (sParts.length === 3 && !sParts.some(isNaN)) {
          const startDateObj = new Date(sParts[0], sParts[1] - 1, sParts[2]);
          const endDateObj = new Date(startDateObj);
          endDateObj.setDate(startDateObj.getDate() + (days - 1));
          const endDateStr = formatDateYMD(endDateObj);

          if (dateStr > endDateStr) {
            return false;
          }
        }
      }
    }

    return true;
  });
}
