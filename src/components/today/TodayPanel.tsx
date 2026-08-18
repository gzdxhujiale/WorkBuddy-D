import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronDown,
  Check,
  Calendar,
  AlignLeft,
  FolderKanban,
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
import { hasTaskDescription } from "@/lib/taskDescription";
import { useProjectsData } from "@/hooks/useProjects";
import { useUiStore } from "@/stores/uiStore";
import { ProjectTimeline } from "./ProjectTimeline";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import {
  PixelSparkle,
  PixelSword,
  PixelScroll,
} from "@/components/pixel/PixelIcons";

// ============================================================
// Constants & Pure Selectors
// ============================================================
const EMPTY_TASKS: Task[] = [];
const EMPTY_HABITS: Habit[] = [];
const EMPTY_CHECKINS: HabitCheckIn[] = [];
const EMPTY_REVIEWS: DailyReviewItem[] = [];

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
  const { isPixelTheme } = useAppThemeStyle();
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

  const { data: projectsData } = useProjectsData();
  const projects = projectsData?.projects ?? [];
  const stages = projectsData?.stages ?? [];
  const setHoveredStageId = useUiStore((s) => s.setHoveredStageId);

  type TaskFilterType = "all" | "project" | "standalone";
  const [taskFilter, setTaskFilter] = useState<TaskFilterType>("all");

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

  // Filter tasks due today sorted by quadrant (Q2 > Q1 > Q3 > Q4) then deadline
  const dueTasks = useMemo(
    () =>
      sortTasksByQuadrantAndDeadline(
        tasks.filter((task) => taskIntersectsDay(task, new Date(`${today}T00:00:00`)))
      ),
    [tasks, today]
  );
  const pendingTasks = useMemo(() => dueTasks.filter((t) => !t.completed), [dueTasks]);

  const projectTasksCount = useMemo(() => dueTasks.filter((t) => Boolean(t.projectId)).length, [dueTasks]);
  const standaloneTasksCount = useMemo(() => dueTasks.filter((t) => !t.projectId).length, [dueTasks]);

  const filteredDueTasks = useMemo(() => {
    if (taskFilter === "project") {
      return dueTasks.filter((t) => Boolean(t.projectId));
    }
    if (taskFilter === "standalone") {
      return dueTasks.filter((t) => !t.projectId);
    }
    return dueTasks;
  }, [dueTasks, taskFilter]);

  // Group due tasks by quadrant with uncompleted first, then completed
  const tasksByQuadrant = useMemo(() => {
    const map: Record<QuadrantType, Task[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };
    for (const task of filteredDueTasks) {
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
  }, [filteredDueTasks]);

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

  const remaining = pendingTasks.length + uncheckedHabits.length + (reviewWritten ? 0 : 1);

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
      onClosed: () => { },
    });
  };

  const renderTaskItem = (task: Task) => {
    const due = !task.completed && task.scheduledEndAt ? dueLabel(task.scheduledEndAt, now) : null;
    const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
    const stage = task.projectStageId ? stages.find((s) => s.id === task.projectStageId) : undefined;

    return (
      <div
        key={task.id}
        onClick={(e) => openTaskQuickEdit(task, e.currentTarget)}
        onMouseEnter={() => {
          if (task.projectStageId) setHoveredStageId(task.projectStageId);
        }}
        onMouseLeave={() => {
          if (task.projectStageId) setHoveredStageId(null);
        }}
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group select-none",
          isPixelTheme && "hover:bg-amber-100/50 dark:hover:bg-amber-950/40",
          task.completed && "opacity-75 bg-muted/15"
        )}
      >
        {/* Left Side: Circular Checkbox & Task Title & Project Badge */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTask(task);
            }}
            className={cn(
              "size-5 flex items-center justify-center shrink-0 transition-all cursor-pointer",
              isPixelTheme ? "rounded-xs" : "rounded-full",
              task.completed
                ? isPixelTheme
                  ? "bg-emerald-600 text-white border border-emerald-800 shadow-[1px_1px_0px_#064e3b]"
                  : "bg-emerald-600 dark:bg-emerald-500 text-white shadow-2xs"
                : isPixelTheme
                  ? "border-2 border-amber-900/60 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:border-emerald-500"
                  : "border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 bg-transparent"
            )}
          >
            {task.completed && <Check size={12} className="stroke-[3]" />}
          </button>

          {project && stage && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium shrink-0 max-w-[130px] truncate border",
                isPixelTheme
                  ? "rounded-xs font-mono bg-amber-100/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-800/40 shadow-[1px_1px_0px_#000]"
                  : "rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60"
              )}
              title={`所属项目：${project.name} · ${stage.name}`}
            >
              <FolderKanban size={10} className="shrink-0 text-sky-500" />
              <span className="truncate">{project.name} · {stage.name}</span>
            </span>
          )}

          <span
            className={cn(
              "text-sm font-medium text-foreground truncate transition-colors",
              isPixelTheme && "font-mono",
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
                isPixelTheme && "font-mono",
                due.overdue ? "text-red-500 font-semibold" : "text-muted-foreground"
              )}
            >
              {due.text}
            </span>
          )}
          {hasTaskDescription(task.description) && (
            <span title="包含任务详情" className="text-muted-foreground/70 flex items-center">
              <AlignLeft size={13} />
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

  const getQuadrantTitle = (q: QuadrantConfig) => {
    if (!isPixelTheme) return q.title;
    switch (q.type) {
      case "Q1":
        return "🔥 紧急讨伐";
      case "Q2":
        return "🌿 核心修炼";
      case "Q3":
        return "⚡ 突发委托";
      case "Q4":
        return "💧 支线见闻";
      default:
        return q.title;
    }
  };

  const renderQuadrantSection = (q: QuadrantConfig) => {
    const quadrantTasks = tasksByQuadrant[q.type];
    if (quadrantTasks.length === 0) return null;

    const isCollapsed = collapsedQuadrants[q.type];

    return (
      <div
        key={q.type}
        className={cn(
          "bg-card overflow-hidden",
          isPixelTheme
            ? "border-2 border-border/90 rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,0.08)]"
            : "border border-border rounded-t-2xl rounded-b-none shadow-xs"
        )}
      >
        {/* Quadrant Card Header */}
        <div
          onClick={() => toggleQuadrantCollapse(q.type)}
          className={cn(
            "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors select-none",
            isPixelTheme ? "hover:bg-amber-100/60 dark:hover:bg-amber-950/40" : "hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn(isPixelTheme ? "size-2.5 rounded-xs" : "size-2.5 rounded-full shrink-0", q.dotColor)} />
            <span className={cn("text-sm font-bold text-foreground", isPixelTheme && "font-mono")}>
              {getQuadrantTitle(q)}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-semibold tabular-nums border",
                isPixelTheme ? "rounded-xs font-mono" : "rounded-full",
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
    <div className="flex flex-col h-full w-full max-w-[1240px] mx-auto px-5 py-6 md:px-8 overflow-y-auto select-none space-y-6">
      {/* ===== 上部分：左上 (任务列表) + 右上 (习惯打卡 & 每日复盘) ===== */}
      {remaining === 0 && dueTasks.length === 0 && todayHabits.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3.5 text-center text-muted-foreground py-7 bg-card",
            isPixelTheme
              ? "border-2 border-border/90 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
              : "rounded-xl border border-border/70 shadow-xs"
          )}
        >
          <div className="text-4xl leading-none">{isPixelTheme ? "🏆" : "🍃"}</div>
          <h2 className="text-base font-bold text-foreground">
            {isPixelTheme ? "⚔️ 今日委托已全数通关！" : "今日已清空"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            {dueTasks.length} 项任务 · {checkedHabits.length} 次打卡 · {reviewWritten ? "1 篇复盘" : "复盘"}
            ，经验值与金币已结算。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)] gap-6 items-start">
          {/* 左上区域: 任务列表 (按象限分组) */}
          <div className="min-w-0 space-y-3.5">
            {/* Header: Title + Filter Pills */}
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                {isPixelTheme ? <PixelSparkle size={14} /> : <span className="size-2 rounded-2xs bg-blue-500 shrink-0" />}
                <span className={isPixelTheme ? "font-mono font-bold" : ""}>
                  {isPixelTheme ? "今日冒险委托" : "今日到期"}
                </span>
                <span className="font-semibold text-muted-foreground tabular-nums">
                  {filteredDueTasks.length} 项
                </span>
              </div>

              {/* Task Filter Pills */}
              <div
                className={cn(
                  "flex items-center gap-1 p-0.5 border text-xs select-none",
                  isPixelTheme
                    ? "rounded-xs border-border bg-muted/60 font-mono shadow-[1px_1px_0px_#000]"
                    : "rounded-lg border-border/70 bg-muted/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => setTaskFilter("all")}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                    isPixelTheme ? "rounded-xs" : "rounded-md",
                    taskFilter === "all"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  全部 {dueTasks.length}
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter("project")}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1",
                    isPixelTheme ? "rounded-xs" : "rounded-md",
                    taskFilter === "project"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{isPixelTheme ? "⚔️ 仅项目" : "仅项目"}</span>
                  <span className="opacity-75 tabular-nums">{projectTasksCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter("standalone")}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1",
                    isPixelTheme ? "rounded-xs" : "rounded-md",
                    taskFilter === "standalone"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{isPixelTheme ? "🍃 仅独立" : "仅独立"}</span>
                  <span className="opacity-75 tabular-nums">{standaloneTasksCount}</span>
                </button>
              </div>
            </div>

            {filteredDueTasks.length === 0 ? (
              <div
                className={cn(
                  "py-8 text-center text-xs text-muted-foreground bg-card/40 border",
                  isPixelTheme
                    ? "border-2 border-border/80 rounded-lg font-mono shadow-[2px_2px_0px_rgba(0,0,0,0.06)]"
                    : "rounded-xl border-border/60"
                )}
              >
                {dueTasks.length === 0
                  ? isPixelTheme
                    ? "今日暂无委托，休息一下吧"
                    : "今天没有到期任务"
                  : taskFilter === "project"
                  ? isPixelTheme
                    ? "今日暂无公会项目委托"
                    : "今天没有属于项目的到期任务"
                  : isPixelTheme
                  ? "今日暂无独立日常委托"
                  : "今天没有独立的日常待办"}
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {QUADRANTS.map(renderQuadrantSection)}
              </div>
            )}
          </div>

          {/* 右上区域: 习惯打卡 + 每日复盘 */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* 习惯打卡卡片 */}
            <div
              className={cn(
                "bg-card p-4 shadow-xs",
                isPixelTheme
                  ? "border-2 border-border/90 rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,0.08)] font-mono"
                  : "border border-border rounded-xl"
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-foreground mb-2.5">
                {isPixelTheme ? <PixelSword size={14} /> : <span className="size-2 rounded-2xs bg-emerald-500 shrink-0" />}
                <span>{isPixelTheme ? "每日修行" : "习惯打卡"}</span>
                <span className="font-semibold text-muted-foreground tabular-nums">
                  {checkedHabits.length} / {todayHabits.length}
                </span>
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
                        className={cn(
                          "px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-600/40 hover:bg-emerald-200 transition-colors cursor-pointer shrink-0",
                          isPixelTheme ? "rounded-xs border-2 border-emerald-700 shadow-[1px_1px_0px_#064e3b]" : "rounded-full"
                        )}
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
                      <span
                        className={cn(
                          "size-5 bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0",
                          isPixelTheme ? "rounded-xs border border-emerald-700" : "rounded-full"
                        )}
                      >
                        ✓
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 每日复盘卡片 */}
            <div
              className={cn(
                "bg-card p-4 shadow-xs",
                isPixelTheme
                  ? "border-2 border-border/90 rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,0.08)] font-mono"
                  : "border border-border rounded-xl"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  {isPixelTheme ? <PixelScroll size={14} /> : <span className="size-2 rounded-2xs bg-amber-500 shrink-0" />}
                  <span>{isPixelTheme ? "冒险日志" : "每日复盘"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/daily-review" })}
                  className={cn(
                    "text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium",
                    isPixelTheme && "font-mono font-bold"
                  )}
                >
                  <span>前往</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <div className="text-xs text-muted-foreground">
                {reviewWritten ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>✨ 今日已完成复盘，复利积累中</span>
                  </div>
                ) : (
                  <span>今日尚未记录复盘心得，总结今日让成长加速</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 下部分：项目时间线 ===== */}
      <div className="w-full pt-1">
        <ProjectTimeline />
      </div>
    </div>
  );
};


