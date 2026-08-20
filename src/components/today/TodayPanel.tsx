import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronDown,
  Check,
  Calendar,
  AlignLeft,
  FolderKanban,
  Clock,
  LayoutGrid,
  Sparkles,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { useTimeManagementData, useTaskActions } from "@/hooks/useTimeManagement";
import { Task, QuadrantType } from "@/types/timeManagement";
import { useHabitData, useHabitActions } from "@/hooks/useHabits";
import { Habit, HabitCheckIn } from "@/types/habit";
import { useDailyReviewData, useReviewActions, isReviewEmpty } from "@/hooks/useDailyReview";
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
  PixelFlame,
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

function dueLabel(scheduledEndAt: number, now: number): { text: string; overdue: boolean; isToday: boolean } {
  const d = new Date(scheduledEndAt);
  const isOverdue = scheduledEndAt < now;
  if (isOverdue) {
    const mins = Math.floor((now - scheduledEndAt) / 60000);
    const text = mins >= 60 ? `已逾期 ${Math.floor(mins / 60)}h` : `已逾期 ${Math.max(1, mins)}m`;
    return { text, overdue: true, isToday: true };
  }
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (hh === "00" && mm === "00") {
    return { text: "今日截止", overdue: false, isToday: true };
  }
  return { text: `${hh}:${mm} 前`, overdue: false, isToday: true };
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

function getCheckInStatus(checkIns: HabitCheckIn[], habitId: string, dateStr: string): boolean {
  return checkIns.some((ci) => ci.habitId === habitId && ci.date === dateStr && ci.completed);
}

function getHabitStreak(checkIns: HabitCheckIn[], habitId: string): number {
  const habitCheckIns = new Set(
    checkIns
      .filter((ci) => ci.habitId === habitId && ci.completed)
      .map((ci) => ci.date),
  );

  if (habitCheckIns.size === 0) return 0;

  const today = todayYMD();
  const yesterday = formatDateYMD(new Date(Date.now() - 86400000));

  if (!habitCheckIns.has(today) && !habitCheckIns.has(yesterday)) {
    return 0;
  }

  let streak = 0;
  let checkDate = habitCheckIns.has(today) ? new Date(today) : new Date(yesterday);

  while (true) {
    const dateStr = formatDateYMD(checkDate);
    if (habitCheckIns.has(dateStr)) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streak;
}

function extractReviewPlainText(content?: string): string {
  if (!content || isReviewEmpty(content)) return "";
  const trimmed = content.trim();
  try {
    const json = JSON.parse(trimmed);
    if (json.content && Array.isArray(json.content)) {
      return json.content
        .map((block: any) => block.content?.map((c: any) => c.text).join("") || "")
        .filter(Boolean)
        .join("\n")
        .trim();
    }
  } catch {}
  return trimmed.replace(/<[^>]*>/g, "").trim();
}

// ============================================================
// Main Component: TodayPanel
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
  const { saveReview } = useReviewActions();

  const { data: projectsData } = useProjectsData();
  const projects = projectsData?.projects ?? [];
  const stages = projectsData?.stages ?? [];

  const setHoveredStageId = useUiStore((s) => s.setHoveredStageId);
  const hoveredTaskId = useUiStore((s) => s.hoveredTaskId);
  const setHoveredTaskId = useUiStore((s) => s.setHoveredTaskId);

  type TaskFilterType = "all" | "project" | "standalone";
  const [taskFilter, setTaskFilter] = useState<TaskFilterType>("all");
  const [viewMode, setViewMode] = useState<"timeline" | "quadrant">("timeline");

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

  // Warm quick-edit window
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

  // Filter tasks due today sorted by quadrant & deadline
  const dueTasks = useMemo(
    () =>
      sortTasksByQuadrantAndDeadline(
        tasks.filter((task) => taskIntersectsDay(task, new Date(`${today}T00:00:00`)))
      ),
    [tasks, today]
  );
  const pendingTasks = useMemo(() => dueTasks.filter((t) => !t.completed), [dueTasks]);
  const completedTasks = useMemo(() => dueTasks.filter((t) => t.completed), [dueTasks]);

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

  // Chronological sorting for Timeline mode (Overdue -> Earlier today -> Later today -> Anytime -> Completed)
  const chronologicalTasks = useMemo(() => {
    return [...filteredDueTasks].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const aEnd = a.scheduledEndAt ?? a.scheduledStartAt ?? Number.MAX_SAFE_INTEGER;
      const bEnd = b.scheduledEndAt ?? b.scheduledStartAt ?? Number.MAX_SAFE_INTEGER;
      return aEnd - bEnd;
    });
  }, [filteredDueTasks]);

  // Group due tasks by quadrant with uncompleted first
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
  const checkedHabits = useMemo(
    () => todayHabits.filter((h) => getCheckInStatus(checkIns, h.id, today)),
    [todayHabits, checkIns, today]
  );

  const maxHabitStreak = useMemo(() => {
    if (todayHabits.length === 0) return 0;
    return Math.max(...todayHabits.map((h) => getHabitStreak(checkIns, h.id)), 0);
  }, [todayHabits, checkIns]);

  // Daily review status & in-situ text input
  const todayReview = useMemo(() => reviews.find((r) => r.date === today), [reviews, today]);
  const reviewWritten = useMemo(() => Boolean(todayReview && !isReviewEmpty(todayReview.content)), [todayReview]);
  const [reviewInput, setReviewInput] = useState("");
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  useEffect(() => {
    if (todayReview && todayReview.content) {
      setReviewInput(extractReviewPlainText(todayReview.content));
    }
  }, [todayReview]);

  const handleSaveReview = () => {
    if (!reviewInput.trim()) return;
    saveReview(today, reviewInput.trim());
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

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
    const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
    const stage = task.projectStageId ? stages.find((s) => s.id === task.projectStageId) : undefined;
    const isHovered = hoveredTaskId === task.id;

    return (
      <div
        key={task.id}
        onClick={(e) => {
          e.stopPropagation();
          openTaskQuickEdit(task, e.currentTarget);
        }}
        onMouseEnter={() => {
          if (task.projectStageId) setHoveredStageId(task.projectStageId);
          setHoveredTaskId(task.id);
        }}
        onMouseLeave={() => {
          if (task.projectStageId) setHoveredStageId(null);
          setHoveredTaskId(null);
        }}
        className={cn(
          "flex items-center justify-between gap-2.5 px-3.5 py-2.5 transition-all cursor-pointer group select-none text-xs",
          isHovered
            ? isPixelTheme
              ? "bg-amber-100/70 dark:bg-amber-950/60 font-semibold"
              : "bg-muted/60"
            : "hover:bg-muted/30",
          task.completed && "opacity-70 bg-muted/10"
        )}
      >
        {/* Left Side: Circular Checkbox & Task Title & Project Badge */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTask(task);
            }}
            className={cn(
              "size-4.5 flex items-center justify-center shrink-0 transition-all cursor-pointer",
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
            {task.completed && <Check size={11} className="stroke-[3]" />}
          </button>

          {/* Quadrant Dot Indicator in Timeline Mode */}
          {viewMode === "timeline" && (
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                QUADRANTS.find((q) => q.type === task.quadrant)?.dotColor || "bg-emerald-500"
              )}
              title={`优先级：${task.quadrant}`}
            />
          )}

          {project && stage && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] font-medium shrink-0 max-w-[120px] truncate border",
                isPixelTheme
                  ? "rounded-xs font-mono bg-amber-100/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-800/40 shadow-[1px_1px_0px_#000]"
                  : "rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60"
              )}
              title={`所属项目：${project.name} · ${stage.name}`}
            >
              <FolderKanban size={9} className="shrink-0 text-sky-500" />
              <span className="truncate">{project.name}</span>
            </span>
          )}

          <span
            className={cn(
              "text-xs font-medium text-foreground truncate transition-colors",
              isPixelTheme && "font-mono",
              task.completed && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
        </div>

        {/* Right Side: Due Time & Calendar Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          {due && (
            <span
              className={cn(
                "text-[11px] tabular-nums",
                isPixelTheme && "font-mono",
                due.overdue
                  ? isPixelTheme
                    ? "text-red-700 dark:text-red-300 font-bold bg-red-100 dark:bg-red-950/80 px-1 py-0.2 rounded-xs border border-red-800/40 shadow-[1px_1px_0px_#7f1d1d]"
                    : "text-red-500 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {due.text}
            </span>
          )}
          {hasTaskDescription(task.description) && (
            <span title="包含任务详情" className="text-muted-foreground/70 flex items-center">
              <AlignLeft size={12} />
            </span>
          )}
          <Calendar
            size={13}
            className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0"
          />
        </div>
      </div>
    );
  };

  const getQuadrantTitle = (q: QuadrantConfig) => {
    if (!isPixelTheme) return q.title;
    switch (q.type) {
      case "Q1": return "🔥 紧急讨伐";
      case "Q2": return "🌿 核心修炼";
      case "Q3": return "⚡ 突发委托";
      case "Q4": return "💧 支线见闻";
      default: return q.title;
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
            ? "border-2 border-border/90 rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,0.08)] font-mono"
            : "border border-border rounded-lg shadow-2xs"
        )}
      >
        {/* Quadrant Card Header */}
        <div
          onClick={() => toggleQuadrantCollapse(q.type)}
          className={cn(
            "flex items-center justify-between px-3.5 py-2 cursor-pointer transition-colors select-none text-xs",
            isPixelTheme ? "hover:bg-amber-100/60 dark:hover:bg-amber-950/40" : "hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn(isPixelTheme ? "size-2 rounded-xs" : "size-2 rounded-full shrink-0", q.dotColor)} />
            <span className="font-bold text-foreground">
              {getQuadrantTitle(q)}
            </span>
            <span
              className={cn(
                "px-1.5 py-0.2 text-[10px] font-semibold tabular-nums border",
                isPixelTheme ? "rounded-xs font-mono" : "rounded-full",
                q.badgeBg
              )}
            >
              {quadrantTasks.length}
            </span>
          </div>

          <ChevronDown
            size={14}
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
    <div className="flex flex-col h-full w-full max-w-[1240px] mx-auto px-4 py-5 md:px-7 overflow-y-auto select-none space-y-5">
      {/* ===== 上屏：微观聚焦台 (紧凑高度 ~290px，双栏布局) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)] gap-5 items-stretch">
        {/* 左栏：今日行动心流 (时间序 / 象限切换) */}
        <div
          className={cn(
            "flex flex-col h-[290px] bg-card overflow-hidden",
            isPixelTheme
              ? "border-2 border-border/90 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
              : "border border-border rounded-xl shadow-2xs"
          )}
        >
          {/* Header Bar */}
          <div
            className={cn(
              "flex items-center justify-between px-3.5 py-2.5 border-b border-border/70 gap-2 shrink-0 flex-wrap",
              isPixelTheme ? "bg-muted/40" : "bg-muted/20"
            )}
          >
            {/* Title & Stats */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              {isPixelTheme ? <PixelSparkle size={14} /> : <span className="size-2 rounded-2xs bg-blue-500 shrink-0" />}
              <span>{isPixelTheme ? "今日冒险委托" : "今日待办行动流"}</span>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums ml-1">
                {pendingTasks.length > 0 ? `${pendingTasks.length} 项未结` : "全数通关 🏆"}
              </span>
            </div>

            {/* Right Controls: View Switcher & Filter Pills */}
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div
                className={cn(
                  "flex items-center p-0.5 border text-xs select-none",
                  isPixelTheme
                    ? "rounded-xs border-border bg-muted/60 font-mono shadow-[1px_1px_0px_#000]"
                    : "rounded-md border-border/70 bg-muted/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => setViewMode("timeline")}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1",
                    isPixelTheme ? "rounded-xs" : "rounded-xs",
                    viewMode === "timeline"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="按时间推进顺序查看"
                >
                  <Clock size={11} />
                  <span>时间流</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("quadrant")}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1",
                    isPixelTheme ? "rounded-xs" : "rounded-xs",
                    viewMode === "quadrant"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="按四象限优先级查看"
                >
                  <LayoutGrid size={11} />
                  <span>象限</span>
                </button>
              </div>

              {/* Task Filter Pills */}
              <div
                className={cn(
                  "flex items-center p-0.5 border text-xs select-none",
                  isPixelTheme
                    ? "rounded-xs border-border bg-muted/60 font-mono shadow-[1px_1px_0px_#000]"
                    : "rounded-md border-border/70 bg-muted/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => setTaskFilter("all")}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                    isPixelTheme ? "rounded-xs" : "rounded-xs",
                    taskFilter === "all"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  全部 {dueTasks.length}
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter("project")}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                    isPixelTheme ? "rounded-xs" : "rounded-xs",
                    taskFilter === "project"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  仅项目 {projectTasksCount}
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter("standalone")}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                    isPixelTheme ? "rounded-xs" : "rounded-xs",
                    taskFilter === "standalone"
                      ? "bg-background text-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  仅独立 {standaloneTasksCount}
                </button>
              </div>
            </div>
          </div>

          {/* List Content (Scrollable Hub) */}
          <div className="flex-1 overflow-y-auto p-1 divide-y divide-border/60">
            {filteredDueTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-muted-foreground">
                <p className="font-semibold mb-1">
                  {dueTasks.length === 0
                    ? isPixelTheme
                      ? "✨ 今日委托已全数通关！"
                      : "今日没有到期任务"
                    : taskFilter === "project"
                    ? "今日没有属于项目的到期任务"
                    : "今日没有独立的日常待办"}
                </p>
                <p className="text-[11px] opacity-75">
                  {completedTasks.length > 0
                    ? `已累计结算 ${completedTasks.length} 项完成任务`
                    : "可点击下方时间线或任务中心添加安排"}
                </p>
              </div>
            ) : viewMode === "timeline" ? (
              <div className="divide-y divide-border/50">
                {chronologicalTasks.map(renderTaskItem)}
              </div>
            ) : (
              <div className="space-y-2 p-1">
                {QUADRANTS.map(renderQuadrantSection)}
              </div>
            )}
          </div>
        </div>

        {/* 右栏：今日修行 + 原地复盘结印卡 (两段式高度锁定) */}
        <div className="flex flex-col h-[290px] gap-3">
          {/* 上半卡片：今日习惯修行 */}
          <div
            className={cn(
              "flex flex-col h-[132px] bg-card overflow-hidden p-3",
              isPixelTheme
                ? "border-2 border-border/90 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
                : "border border-border rounded-xl shadow-2xs"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1 mb-1.5 shrink-0 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                {isPixelTheme ? <PixelSword size={13} /> : <span className="size-2 rounded-2xs bg-emerald-500 shrink-0" />}
                <span>{isPixelTheme ? "每日修行" : "习惯修行"}</span>
                <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {checkedHabits.length}/{todayHabits.length}
                </span>
              </div>

              {maxHabitStreak > 0 && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-500/40",
                    isPixelTheme ? "rounded-xs font-mono shadow-[1px_1px_0px_#000]" : "rounded-full"
                  )}
                >
                  {isPixelTheme ? <PixelFlame size={10} /> : <Flame size={10} className="text-amber-500" />}
                  <span>连击 {maxHabitStreak} 天</span>
                </div>
              )}
            </div>

            {/* Micro Progress Bar */}
            {todayHabits.length > 0 && (
              <div
                className={cn(
                  "w-full overflow-hidden mb-1.5 shrink-0",
                  isPixelTheme
                    ? "h-2 rounded-xs border border-border/90 bg-muted/60 p-[0.5px] shadow-[1px_1px_0px_#000]"
                    : "h-1 bg-muted rounded-full"
                )}
              >
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    isPixelTheme ? "bg-amber-500 rounded-xs" : "bg-emerald-500 rounded-full"
                  )}
                  style={{
                    width: `${todayHabits.length > 0 ? (checkedHabits.length / todayHabits.length) * 100 : 0}%`,
                  }}
                />
              </div>
            )}

            {/* Habit Items Scroll Area */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/50 text-xs pr-0.5">
              {todayHabits.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
                  今日暂无修行指标
                </div>
              ) : (
                todayHabits.map((habit) => {
                  const isChecked = getCheckInStatus(checkIns, habit.id, today);
                  const streak = getHabitStreak(checkIns, habit.id);

                  return (
                    <div
                      key={habit.id}
                      className={cn(
                        "flex items-center justify-between gap-2 py-1 transition-opacity",
                        isChecked && "opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "truncate text-xs font-medium flex-1",
                          isChecked && "line-through text-muted-foreground"
                        )}
                      >
                        {habit.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 tabular-nums shrink-0">
                        {streak > 0 ? `${streak}天` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCheckIn(habit.id, today, !isChecked)}
                        className={cn(
                          "size-5 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all shrink-0",
                          isPixelTheme ? "rounded-xs" : "rounded-full",
                          isChecked
                            ? "bg-emerald-500 text-white shadow-2xs"
                            : isPixelTheme
                            ? "border border-border bg-muted/80 hover:bg-emerald-100 hover:text-emerald-700 shadow-[1px_1px_0px_#000]"
                            : "border border-border bg-background hover:bg-emerald-50 hover:text-emerald-600"
                        )}
                      >
                        {isChecked ? "✓" : "+"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 下半卡片：今日原地复盘结印卡 */}
          <div
            className={cn(
              "flex flex-col flex-1 bg-card overflow-hidden p-3",
              isPixelTheme
                ? "border-2 border-border/90 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
                : "border border-border rounded-xl shadow-2xs"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1 mb-1.5 shrink-0 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                {isPixelTheme ? <PixelScroll size={13} /> : <span className="size-2 rounded-2xs bg-amber-500 shrink-0" />}
                <span>{isPixelTheme ? "冒险日志结印" : "今日原地复盘"}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate({ to: "/daily-review" })}
                className={cn(
                  "text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium",
                  isPixelTheme && "font-mono font-bold"
                )}
                title="进入完整复盘日志与复利图表"
              >
                <span>完整日志</span>
                <ChevronRight size={11} />
              </button>
            </div>

            {/* In-situ Input Body */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              <textarea
                value={reviewInput}
                onChange={(e) => setReviewInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSaveReview();
                  }
                }}
                placeholder={
                  reviewWritten
                    ? "✨ 今日心得已结印，可在此继续补充感悟 (Ctrl+Enter 保存)..."
                    : "记录今日收获与心得，一键结印完成今日复盘..."
                }
                className={cn(
                  "w-full flex-1 p-2 text-xs outline-none resize-none transition-colors border text-foreground placeholder:text-muted-foreground/60",
                  isPixelTheme
                    ? "rounded-xs border-border bg-muted/40 focus:bg-background focus:border-amber-600 font-mono shadow-[1px_1px_0px_#000]"
                    : "rounded-lg border-border/70 bg-background/50 focus:border-primary focus:bg-background"
                )}
              />

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground/80 truncate">
                  {isSavedFeedback ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      <span>已成功结印存档</span>
                    </span>
                  ) : reviewWritten ? (
                    <span className="text-emerald-600 dark:text-emerald-400">已沉淀今日日志</span>
                  ) : (
                    <span>完成度 {Math.round((completedTasks.length / Math.max(1, dueTasks.length)) * 100)}%</span>
                  )}
                </span>

                <button
                  type="button"
                  disabled={!reviewInput.trim()}
                  onClick={handleSaveReview}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed",
                    isPixelTheme
                      ? "rounded-xs border-2 border-amber-900 bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                      : "rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                  )}
                >
                  <Sparkles size={11} />
                  <span>{reviewWritten ? "更新结印" : "结印存档"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 下屏：项目宏观全景甘特时间线 ===== */}
      <div className="w-full pt-1">
        <ProjectTimeline />
      </div>
    </div>
  );
};


