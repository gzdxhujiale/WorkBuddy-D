import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronDown,
  Check,
  Calendar,
} from "lucide-react";
import { useTimeManagementData, useTaskActions } from "@/hooks/useTimeManagement";
import { Task, QuadrantType } from "@/types/timeManagement";
import { useHabitData, useHabitActions } from "@/hooks/useHabits";
import { Habit, HabitCheckIn } from "@/types/habit";
import { useDailyReviewData } from "@/hooks/useDailyReview";
import { DailyReviewItem } from "@/types/dailyReview";
import { formatDateYMD, todayYMD } from "@/lib/dateUtils";
import { openQuickEditWindow, prewarmQuickEditWindow } from "@/services/quickEditWindow";
import { taskIntersectsDay, sortTasksByQuadrantAndDeadline } from "@/lib/taskSchedule";
import { ProjectTimeline } from "./ProjectTimeline";
import { cn } from "@/lib/utils";

// ============================================================
// Constants & Pure Selectors
// ============================================================
const EMPTY_TASKS: Task[] = [];
const EMPTY_HABITS: Habit[] = [];
const EMPTY_CHECKINS: HabitCheckIn[] = [];
const EMPTY_REVIEWS: DailyReviewItem[] = [];

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
const MONTH_LABELS = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月"
] as const;

interface QuadrantConfig {
  type: QuadrantType;
  title: string;
  dotColor: string;
  badgeBg: string;
}

const QUADRANTS: QuadrantConfig[] = [
  {
    type: "Q1",
    title: "重要且紧急",
    dotColor: "bg-red-500",
    badgeBg: "bg-red-50 text-red-600 border-red-200/80 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60",
  },
  {
    type: "Q2",
    title: "重要不紧急",
    dotColor: "bg-emerald-500",
    badgeBg: "bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
  },
  {
    type: "Q3",
    title: "紧急不重要",
    dotColor: "bg-amber-500",
    badgeBg: "bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
  },
  {
    type: "Q4",
    title: "不重要不紧急",
    dotColor: "bg-slate-400 dark:bg-slate-500",
    badgeBg: "bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
];

function dueLabel(scheduledEndAt: number, now: number): { text: string; overdue: boolean } {
  if (scheduledEndAt < now) {
    const mins = Math.floor((now - scheduledEndAt) / 60000);
    const text = mins >= 60 ? `已逾期 ${Math.floor(mins / 60)}h` : `已逾期 ${Math.max(1, mins)}m`;
    return { text, overdue: true };
  }
  const d = new Date(scheduledEndAt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { text: `${hh}:${mm} 前`, overdue: false };
}

function getHabitsForDate(habits: Habit[], dateStr: string): Habit[] {
  return habits.filter((habit) => {
    let startDateStr = habit.startDate;
    if (!startDateStr || startDateStr.trim() === "") {
      startDateStr = habit.createdAt ? new Date(habit.createdAt).toISOString().slice(0, 10) : dateStr;
    }
    if (dateStr < startDateStr) return false;

    if (habit.duration && habit.duration !== "forever") {
      let days = 0;
      if (habit.duration.startsWith("custom:")) {
        days = parseInt(habit.duration.replace("custom:", ""), 10) || 0;
      } else {
        days = parseInt(habit.duration.replace(/[^0-9]/g, ""), 10) || 0;
      }

      if (days > 0) {
        const parts = startDateStr.split("-").map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          const startDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
          const endDateObj = new Date(startDateObj);
          endDateObj.setDate(startDateObj.getDate() + (days - 1));

          const qParts = dateStr.split("-").map(Number);
          if (qParts.length === 3 && !qParts.some(isNaN)) {
            const queryDateObj = new Date(qParts[0], qParts[1] - 1, qParts[2]);
            if (queryDateObj > endDateObj) {
              return false;
            }
          }
        }
      }
    }
    return true;
  });
}

function getCheckInStatus(checkIns: HabitCheckIn[], habitId: string, date: string): boolean {
  const checkIn = checkIns.find((c) => c.habitId === habitId && c.date === date);
  return checkIn ? checkIn.completed : false;
}

function getHabitStreak(checkIns: HabitCheckIn[], habitId: string): number {
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedDates = new Set(
    checkIns.filter((c) => c.habitId === habitId && c.completed).map((c) => c.date)
  );

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateString = formatDateYMD(checkDate);

    if (completedDates.has(dateString)) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function isReviewWritten(reviews: DailyReviewItem[], dateStr: string): boolean {
  const item = reviews.find((r) => r.date === dateStr);
  if (!item || !item.content) return false;
  return item.content.trim().length > 0 && item.content.trim() !== "{}";
}

// ============================================================
// Main Component: TodayPanel (Consolidated 1:1 Replica)
// ============================================================
export const TodayPanel: React.FC = () => {
  const navigate = useNavigate();

  const { data: timeData } = useTimeManagementData();
  const tasks = timeData?.tasks ?? EMPTY_TASKS;
  const { updateTask } = useTaskActions();

  const { data: habitData } = useHabitData();
  const habits = habitData?.habits ?? EMPTY_HABITS;
  const checkIns = habitData?.checkIns ?? EMPTY_CHECKINS;
  const { toggleCheckIn } = useHabitActions();

  const { data: reviewsData } = useDailyReviewData();
  const reviews = reviewsData ?? EMPTY_REVIEWS;

  const [collapsedQuadrants, setCollapsedQuadrants] = useState<Record<QuadrantType, boolean>>({
    Q1: false,
    Q2: false,
    Q3: false,
    Q4: false,
  });

  const toggleQuadrantCollapse = (quadrant: QuadrantType) => {
    setCollapsedQuadrants((prev) => ({
      ...prev,
      [quadrant]: !prev[quadrant],
    }));
  };

  const [meterReady, setMeterReady] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMeterReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // The editor is an event-only window. Warm it after the first paint so the
  // first task click does not pay the cost of creating a new WebView.
  useEffect(() => {
    const timer = window.setTimeout(() => prewarmQuickEditWindow(), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const [, forceTick] = React.useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const timer = setInterval(forceTick, 60_000);
    return () => clearInterval(timer);
  }, []);

  const now = Date.now();
  const today = todayYMD();
  const todayDate = useMemo(() => new Date(), []);

  // Filter tasks due today sorted by quadrant (Q2 > Q1 > Q3 > Q4) then deadline
  const dueTasks = useMemo(
    () =>
      sortTasksByQuadrantAndDeadline(
        tasks.filter((task) => taskIntersectsDay(task, new Date(`${today}T00:00:00`)))
      ),
    [tasks, today]
  );
  const pendingTasks = useMemo(() => dueTasks.filter((t) => !t.completed), [dueTasks]);

  // Group due tasks by quadrant with uncompleted first, then completed
  const tasksByQuadrant = useMemo(() => {
    const map: Record<QuadrantType, Task[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };
    for (const task of dueTasks) {
      if (map[task.quadrant]) {
        map[task.quadrant].push(task);
      } else {
        map.Q2.push(task);
      }
    }
    for (const q of Object.keys(map) as QuadrantType[]) {
      map[q].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return (a.scheduledEndAt ?? Number.MAX_SAFE_INTEGER) - (b.scheduledEndAt ?? Number.MAX_SAFE_INTEGER);
      });
    }
    return map;
  }, [dueTasks]);

  // Today habits
  const todayHabits = useMemo(() => getHabitsForDate(habits, today), [habits, today]);
  const uncheckedHabits = useMemo(
    () => todayHabits.filter((h) => !getCheckInStatus(checkIns, h.id, today)),
    [todayHabits, checkIns, today]
  );
  const checkedHabits = useMemo(
    () => todayHabits.filter((h) => getCheckInStatus(checkIns, h.id, today)),
    [todayHabits, checkIns, today]
  );

  // Daily review status
  const reviewWritten = useMemo(() => isReviewWritten(reviews, today), [reviews, today]);

  // Progress metrics
  const totalCount = dueTasks.length + todayHabits.length + 1;
  const remaining = pendingTasks.length + uncheckedHabits.length + (reviewWritten ? 0 : 1);
  const clearedPct = totalCount > 0 ? Math.round(((totalCount - remaining) / totalCount) * 100) : 100;
  const segWidth = (count: number) => (meterReady && totalCount > 0 ? `${(count / totalCount) * 100}%` : "0%");

  const handleToggleTask = useCallback(
    (task: Task) => {
      const isCompleted = !task.completed;
      updateTask(task.id, {
        completed: isCompleted,
        completedAt: isCompleted ? Date.now() : undefined,
      });
    },
    [updateTask]
  );

  const openTaskQuickEdit = (task: Task, anchor: HTMLElement) => {
    void openQuickEditWindow({
      task,
      anchorEl: anchor,
      onCommit: (taskId, updates) => updateTask(taskId, updates),
      onClosed: () => {},
    });
  };

  const renderTaskItem = (task: Task) => {
    const due = !task.completed && task.scheduledEndAt ? dueLabel(task.scheduledEndAt, now) : null;

    return (
      <div
        key={task.id}
        onClick={(e) => openTaskQuickEdit(task, e.currentTarget)}
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group select-none",
          task.completed && "opacity-75 bg-muted/15"
        )}
      >
        {/* Left Side: Circular Checkbox & Task Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTask(task);
            }}
            className={cn(
              "size-5 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer",
              task.completed
                ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-2xs"
                : "border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 bg-transparent"
            )}
          >
            {task.completed && <Check size={12} className="stroke-[3]" />}
          </button>

          <span
            className={cn(
              "text-sm font-medium text-foreground truncate transition-colors",
              task.completed && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
        </div>

        {/* Right Side: Due Time & Calendar Icon */}
        <div className="flex items-center gap-2 shrink-0">
          {due && (
            <span
              className={cn(
                "text-xs tabular-nums",
                due.overdue ? "text-red-500 font-semibold" : "text-muted-foreground"
              )}
            >
              {due.text}
            </span>
          )}
          <Calendar
            size={15}
            className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0"
          />
        </div>
      </div>
    );
  };

  const renderQuadrantSection = (q: QuadrantConfig) => {
    const quadrantTasks = tasksByQuadrant[q.type];
    if (quadrantTasks.length === 0) return null;

    const isCollapsed = collapsedQuadrants[q.type];

    return (
      <div
        key={q.type}
        className="bg-card border border-border rounded-xl shadow-xs overflow-hidden"
      >
        {/* Quadrant Card Header */}
        <div
          onClick={() => toggleQuadrantCollapse(q.type)}
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5">
            <span className={cn("size-2.5 rounded-full shrink-0", q.dotColor)} />
            <span className="text-sm font-bold text-foreground">{q.title}</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums border",
                q.badgeBg
              )}
            >
              {quadrantTasks.length}
            </span>
          </div>

          <ChevronDown
            size={16}
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              isCollapsed ? "-rotate-90" : "rotate-0"
            )}
          />
        </div>

        {/* Quadrant Card Items List */}
        {!isCollapsed && (
          <div className="divide-y divide-border/60 border-t border-border/60">
            {quadrantTasks.map(renderTaskItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full max-w-[1080px] mx-auto px-6 py-6 md:px-9 overflow-y-auto select-none space-y-6">
      {/* 签名元素: 撕历式头部 */}
      <header className="flex items-start gap-6 pb-5 border-b border-border shrink-0">
        {/* 撕历日期块 */}
        <div className="relative flex flex-col items-center shrink-0 px-4 py-2.5 bg-card border border-border rounded-xl shadow-xs">
          {/* 两个装订孔 */}
          <div className="absolute -top-1 left-[22%] size-1.5 rounded-full bg-background border border-border" />
          <div className="absolute -top-1 right-[22%] size-1.5 rounded-full bg-background border border-border" />

          <div className="text-5xl font-black text-foreground leading-none tracking-tight tabular-nums pt-1">
            {todayDate.getDate()}
          </div>
          <div className="text-xs text-muted-foreground tracking-[3px] pl-0.5 mt-1">
            {MONTH_LABELS[todayDate.getMonth()]} · {WEEKDAY_LABELS[todayDate.getDay()]}
          </div>
        </div>

        {/* Header Main */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h1 className="text-xl font-bold text-foreground">
              {remaining === 0 ? (
                "今日已清空"
              ) : (
                <>
                  今天还剩 <span className="text-blue-600 dark:text-blue-400 font-bold">{remaining}</span> 件事
                </>
              )}
            </h1>
            <span className="text-xs text-muted-foreground tabular-nums ml-auto">
              已清空 {clearedPct}%
            </span>
          </div>

          {/* 清空进度条: 三色分段燃尽条 */}
          <div
            className="flex h-2.5 rounded-full overflow-hidden bg-muted border border-border"
            role="img"
            aria-label={`今日剩余：任务${pendingTasks.length}件、习惯${uncheckedHabits.length}项、复盘${reviewWritten ? "已写" : "未写"}`}
          >
            <div className="h-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: segWidth(pendingTasks.length) }} />
            <div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: segWidth(uncheckedHabits.length) }} />
            <div className="h-full bg-violet-500 transition-all duration-500 ease-out" style={{ width: segWidth(reviewWritten ? 0 : 1) }} />
          </div>

          {/* 图例 */}
          <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-2xs bg-blue-500" />
              今日到期任务 <b className="text-foreground font-semibold tabular-nums">{pendingTasks.length}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-2xs bg-emerald-500" />
              待打卡习惯 <b className="text-foreground font-semibold tabular-nums">{uncheckedHabits.length}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-2xs bg-violet-500" />
              复盘 <b className="text-foreground font-semibold">{reviewWritten ? "已写" : "未写"}</b>
            </span>
          </div>
        </div>
      </header>

      {/* 主体: 主列表 + 右侧轻栏 */}
      {remaining === 0 && dueTasks.length === 0 && todayHabits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3.5 text-center text-muted-foreground py-6 rounded-2xl bg-card border border-border/70">
          <div className="text-4xl leading-none">🍃</div>
          <h2 className="text-base font-bold text-foreground">今日已清空</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            {dueTasks.length} 项任务 · {checkedHabits.length} 次打卡 · {reviewWritten ? "1 篇复盘" : "复盘"}
            ，都完成了。剩下的时间是你自己的。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-6">
          {/* 左栏: 任务主列表 (按象限分组) */}
          <div className="min-w-0 pr-1 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground mb-1">
              <span className="size-2 rounded-2xs bg-blue-500 shrink-0" />
              今日到期 <span className="font-semibold text-muted-foreground tabular-nums">{dueTasks.length} 项</span>
            </div>

            {dueTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground bg-card/40 rounded-xl border border-border/60">
                今天没有到期任务
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {QUADRANTS.map(renderQuadrantSection)}
              </div>
            )}
          </div>

          {/* 右侧轻栏: 习惯 + 复盘 */}
          <div className="flex flex-col gap-4">
            {/* 习惯打卡卡片 */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground mb-2.5">
                <span className="size-2 rounded-2xs bg-emerald-500 shrink-0" />
                习惯打卡 <span className="font-semibold text-muted-foreground tabular-nums">{checkedHabits.length} / {todayHabits.length}</span>
              </div>

              {todayHabits.length === 0 ? (
                <div className="py-3 text-xs text-muted-foreground">今天没有需要打卡的习惯</div>
              ) : (
                <div className="flex flex-col">
                  {uncheckedHabits.map((habit) => (
                    <div key={habit.id} className="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0">
                      <span className="flex-1 min-w-0 text-xs text-foreground truncate">{habit.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        连续 {getHabitStreak(checkIns, habit.id)} 天
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCheckIn(habit.id, today, true)}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer shrink-0"
                      >
                        打卡
                      </button>
                    </div>
                  ))}

                  {checkedHabits.map((habit) => (
                    <div key={habit.id} className="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0 opacity-60">
                      <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate line-through">{habit.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        连续 {getHabitStreak(checkIns, habit.id)} 天
                      </span>
                      <span className="size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        ✓
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 每日复盘卡片 */}
            <div className={`bg-card border border-border border-l-3 border-l-violet-500 rounded-xl p-4 shadow-xs`}>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground mb-1.5">
                <span className="size-2 rounded-2xs bg-violet-500 shrink-0" />
                每日复盘
              </div>

              {reviewWritten ? (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">今天的复盘已经写好了 ✓</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed my-2">
                    今天的复盘还没写。花 5 分钟回顾一下，明天会更清楚该做什么。
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/daily-review" })}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-500/30 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-colors cursor-pointer"
                  >
                    去写复盘 <ChevronRight size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 项目时间线 */}
      <ProjectTimeline />
    </div>
  );
};

