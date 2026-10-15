import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronDown,
  Clock,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useTimeManagementData, useTaskActions } from "../hooks/useTimeManagement";
import type { Task, QuadrantType } from "@/types/task";
import type { Project, ProjectStage } from "@/types/project";
import { todayYMD } from "@/lib/dateUtils";
import { openQuickEditWindow, prewarmQuickEditWindow } from "@/app/windows/quickEditWindowManager";
import {
  taskBelongsToToday,
  isTaskOverdue,
  getOverdueDurationLabel,
  sortTasksByQuadrantAndDeadline,
} from "@/lib/taskSchedule";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelSparkle } from "@/components/pixel/PixelIcons";
import { TodayTaskItem } from "./TodayTaskItem";

const EMPTY_TASKS: Task[] = [];
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_STAGES: ProjectStage[] = [];

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
    return { text: getOverdueDurationLabel(scheduledEndAt, now), overdue: true, isToday: false };
  }
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (hh === "00" && mm === "00") {
    return { text: "今日截止", overdue: false, isToday: true };
  }
  return { text: `${hh}:${mm} 前`, overdue: false, isToday: true };
}

export interface TodayTasksSectionProps {
  projects?: Project[];
  stages?: ProjectStage[];
  hoveredTaskId?: string | null;
  onHoverTask?: (taskId: string | null) => void;
  onHoverStage?: (stageId: string | null) => void;
}

export const TodayTasksSection: React.FC<TodayTasksSectionProps> = ({
  projects = EMPTY_PROJECTS,
  stages = EMPTY_STAGES,
  hoveredTaskId,
  onHoverTask,
  onHoverStage,
}) => {
  const { isPixelTheme } = useAppThemeStyle();

  const { data: timeData } = useTimeManagementData();
  const tasks = timeData?.tasks ?? EMPTY_TASKS;
  const { updateTask } = useTaskActions();

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
  const todayDate = useMemo(() => new Date(`${today}T00:00:00`), [today]);
  const todayEndTimestamp = useMemo(() => new Date(`${today}T23:59:59`).getTime(), [today]);

  const dueTasks = useMemo(
    () =>
      sortTasksByQuadrantAndDeadline(
        tasks.filter((task) => taskBelongsToToday(task, todayDate)),
        now
      ),
    [tasks, todayDate, now]
  );
  const pendingTasks = useMemo(() => dueTasks.filter((t) => !t.completed), [dueTasks]);
  const overdueTasks = useMemo(() => dueTasks.filter((t) => !t.completed && isTaskOverdue(t, now)), [dueTasks, now]);

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

  const chronologicalTasks = useMemo(() => {
    return [...filteredDueTasks].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const aOverdue = isTaskOverdue(a, now);
      const bOverdue = isTaskOverdue(b, now);
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1;
      }
      const aEnd = a.scheduledEndAt ?? a.scheduledStartAt ?? Number.MAX_SAFE_INTEGER;
      const bEnd = b.scheduledEndAt ?? b.scheduledStartAt ?? Number.MAX_SAFE_INTEGER;
      return aEnd - bEnd;
    });
  }, [filteredDueTasks, now]);

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
        const aOverdue = isTaskOverdue(a, now);
        const bOverdue = isTaskOverdue(b, now);
        if (aOverdue !== bOverdue) {
          return aOverdue ? -1 : 1;
        }
        return (a.scheduledEndAt ?? Number.MAX_SAFE_INTEGER) - (b.scheduledEndAt ?? Number.MAX_SAFE_INTEGER);
      });
    }
    return map;
  }, [filteredDueTasks, now]);

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

  const handleRescheduleToToday = useCallback(
    (task: Task, e: React.MouseEvent) => {
      e.stopPropagation();
      updateTask(task.id, {
        scheduledEndAt: todayEndTimestamp,
        scheduleMode: task.scheduleMode || "point",
      });
    },
    [updateTask, todayEndTimestamp]
  );

  const handleRescheduleAllOverdue = useCallback(() => {
    for (const task of overdueTasks) {
      updateTask(task.id, {
        scheduledEndAt: todayEndTimestamp,
        scheduleMode: task.scheduleMode || "point",
      });
    }
  }, [overdueTasks, updateTask, todayEndTimestamp]);

  const openTaskQuickEdit = useCallback((task: Task, anchor: HTMLElement) => {
    void openQuickEditWindow({
      task,
      projects,
      stages,
      anchorEl: anchor,
      onCommit: (taskId, updates) => updateTask(taskId, updates),
      onClosed: () => {},
    });
  }, [projects, stages, updateTask]);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const renderTaskItem = useCallback((task: Task) => {
    const overdue = !task.completed && isTaskOverdue(task, now);
    const due = !task.completed && task.scheduledEndAt ? dueLabel(task.scheduledEndAt, now) : null;
    const project = task.projectId ? projectMap.get(task.projectId) : undefined;
    const stage = task.projectStageId ? stageMap.get(task.projectStageId) : undefined;

    return (
      <TodayTaskItem
        key={task.id}
        task={task}
        overdue={overdue}
        due={due}
        project={project}
        stage={stage}
        viewMode={viewMode}
        isPixelTheme={isPixelTheme}
        quadrantDotColor={QUADRANTS.find((q) => q.type === task.quadrant)?.dotColor}
        onToggle={handleToggleTask}
        onReschedule={handleRescheduleToToday}
        onOpenQuickEdit={openTaskQuickEdit}
        hoveredTaskId={hoveredTaskId}
        onHoverTask={onHoverTask}
        onHoverStage={onHoverStage}
      />
    );
  }, [
    now,
    projectMap,
    stageMap,
    viewMode,
    isPixelTheme,
    handleToggleTask,
    handleRescheduleToToday,
    openTaskQuickEdit,
    hoveredTaskId,
    onHoverTask,
    onHoverStage,
  ]);

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

        {!isCollapsed && (
          <div className="divide-y divide-border/60 border-t border-border/60">
            {quadrantTasks.map(renderTaskItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col h-[300px] bg-card overflow-hidden",
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

      {/* Overdue Alert Banner if any overdue tasks exist */}
      {overdueTasks.length > 0 && (
        <div
          className={cn(
            "flex items-center justify-between px-3 py-1.5 text-xs border-b shrink-0 transition-colors",
            isPixelTheme
              ? "bg-red-100/90 dark:bg-red-950/80 text-red-900 dark:text-red-200 border-red-800/40 font-mono"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60"
          )}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={13} className="text-rose-500 shrink-0" />
            <span>发现 {overdueTasks.length} 项历史逾期待办</span>
          </div>
          <button
            type="button"
            onClick={handleRescheduleAllOverdue}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1",
              isPixelTheme
                ? "bg-red-200 dark:bg-red-900 text-red-950 dark:text-red-100 border border-red-950 rounded-none shadow-[1px_1px_0px_#000]"
                : "bg-white dark:bg-rose-900/60 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-700 rounded-md hover:bg-rose-100 dark:hover:bg-rose-800/80"
            )}
            title="将所有逾期任务的截止时间顺延至今日 23:59"
          >
            <RotateCcw size={10} />
            <span>全部顺延至今日</span>
          </button>
        </div>
      )}

      {/* List Content (Scrollable Hub) */}
      <div className="flex-1 overflow-y-auto p-1 divide-y divide-border/60">
        {filteredDueTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-muted-foreground">
            <div className="p-2.5 rounded-full bg-muted/40 mb-2 border border-border/40">
              <CheckCircle2 size={20} className="text-muted-foreground/60" />
            </div>
            <p className="font-semibold text-foreground">今日暂无待办事项</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              可在上方快速记录，或前往「任务中心」规划日程
            </p>
          </div>
        ) : viewMode === "timeline" ? (
          chronologicalTasks.map(renderTaskItem)
        ) : (
          <div className="space-y-2 p-1">
            {QUADRANTS.map(renderQuadrantSection)}
          </div>
        )}
      </div>
    </div>
  );
};
