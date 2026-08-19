import React, { useState, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderKanban,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useProjectsData, useProjectActions } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { formatDateYMD, parseYMD, todayYMD } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelScroll } from "@/components/pixel/PixelIcons";
import { useUiStore } from "@/stores/uiStore";
import { createTaskId } from "@/lib/entityIds";
import { openQuickEditWindow } from "@/services/quickEditWindow";
import { taskIntersectsDay } from "@/lib/taskSchedule";
import type { Project, ProjectTask } from "@/types/projects";
import type { Task } from "@/types/timeManagement";

export type TimelineViewMode = "week" | "biweekly" | "month";

const VIEW_MODE_LABELS: Record<TimelineViewMode, string> = {
  week: "周视图",
  biweekly: "双周视图",
  month: "月视图",
};

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateStr(str?: string | null): Date | null {
  if (!str) return null;
  return parseYMD(str.slice(0, 10));
}

function getLocalDayMidnight(val?: Date | number | string | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "number") {
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string") {
    const parsed = parseYMD(val.slice(0, 10));
    if (parsed) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatRangeLabel(viewMode: TimelineViewMode, startDate: Date, endDate: Date): string {
  const sYear = startDate.getFullYear();
  const sMonth = startDate.getMonth() + 1;
  const sDay = startDate.getDate();
  const eYear = endDate.getFullYear();
  const eMonth = endDate.getMonth() + 1;
  const eDay = endDate.getDate();

  if (viewMode === "month") {
    return `${sYear}年${sMonth}月`;
  }

  if (viewMode === "week") {
    if (sMonth === eMonth) {
      return `${sYear}年${sMonth}月${sDay}日 - ${eDay}日`;
    }
    if (sYear === eYear) {
      return `${sYear}年${sMonth}月${sDay}日 - ${eMonth}月${eDay}日`;
    }
    return `${sYear}年${sMonth}月${sDay}日 - ${eYear}年${eMonth}月${eDay}日`;
  }

  // biweekly
  if (sMonth === eMonth) {
    return `${sYear}年${sMonth}月${sDay}日 - ${eDay}日`;
  }
  if (sYear === eYear) {
    return `${sYear}年${sMonth}月${sDay}日 - ${eMonth}月${eDay}日`;
  }
  return `${sYear}年${sMonth}月${sDay}日 - ${eYear}年${eMonth}月${eDay}日`;
}

function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

interface StageItemWithMeta {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  sortOrder: number;
  startDate?: string;
  endDate?: string;
  computedStart?: Date;
  computedEnd?: Date;
  hasSchedule: boolean;
  intersectsWindow: boolean;
  tasks: ProjectTask[];
}

interface ProjectGroupItem {
  project: Project;
  stages: StageItemWithMeta[];
  tasks: ProjectTask[];
  computedStart?: Date;
  computedEnd?: Date;
  completedTasksCount: number;
  totalTasksCount: number;
}

export const ProjectTimeline: React.FC = () => {
  const navigate = useNavigate();
  const { isPixelTheme } = useAppThemeStyle();
  const { data: projectsData } = useProjectsData();
  const { saveTask } = useProjectActions();
  const hoveredStageId = useUiStore((s) => s.hoveredStageId);
  const setHoveredStageId = useUiStore((s) => s.setHoveredStageId);
  const hoveredTaskId = useUiStore((s) => s.hoveredTaskId);
  const setHoveredTaskId = useUiStore((s) => s.setHoveredTaskId);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);

  const projects = projectsData?.projects ?? [];
  const stages = projectsData?.stages ?? [];
  const tasks = projectsData?.tasks ?? [];

  const [viewMode, setViewMode] = useState<TimelineViewMode>("biweekly");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  // Single unified scrolling system:
  // - Top Header (headerScrollRef) horizontally syncs with Right Track (rightScrollRef)
  // - Left Tree (leftScrollRef) vertically syncs with Right Track (rightScrollRef) without having its own scrollbar
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  const handleRightScroll = () => {
    if (rightScrollRef.current) {
      // Sync vertical scroll to left tree
      if (leftScrollRef.current) {
        leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      }
      // Sync horizontal scroll to top day header
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = rightScrollRef.current.scrollLeft;
      }
    }
  };

  const handleLeftWheel = (e: React.WheelEvent) => {
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop += e.deltaY;
    }
  };

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  // Active anchor reference date
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Active project selection
  const currentProject: Project | undefined = useMemo(() => {
    if (selectedProjectId && selectedProjectId !== "all") {
      return projects.find((p) => p.id === selectedProjectId);
    }
    return undefined;
  }, [projects, selectedProjectId]);

  const todayStr = todayYMD();
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Compute start/end window dates
  const { windowStartDate, totalDays, windowEndDate } = useMemo(() => {
    if (viewMode === "month") {
      const year = anchorDate.getFullYear();
      const month = anchorDate.getMonth();
      const start = new Date(year, month, 1);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const end = new Date(year, month, daysInMonth);
      return { windowStartDate: start, totalDays: daysInMonth, windowEndDate: end };
    }

    if (viewMode === "week") {
      const start = getMonday(anchorDate);
      const days = 7;
      const end = addDays(start, days - 1);
      return { windowStartDate: start, totalDays: days, windowEndDate: end };
    }

    // biweekly: 14 days starting from Monday
    const start = getMonday(anchorDate);
    const days = 14;
    const end = addDays(start, days - 1);
    return { windowStartDate: start, totalDays: days, windowEndDate: end };
  }, [viewMode, anchorDate]);

  // Date list for the visible window
  const dateList = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      list.push(addDays(windowStartDate, i));
    }
    return list;
  }, [windowStartDate, totalDays]);

  const timelineDays = useMemo(() => {
    return dateList.map((d) => {
      const dStr = formatDateYMD(d);
      const isToday = dStr === todayStr;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dayNum = d.getDate();
      const weekdayName = WEEKDAY_NAMES[d.getDay()];
      return {
        date: d,
        dateStr: dStr,
        dayNum,
        weekdayName,
        isToday,
        isWeekend,
      };
    });
  }, [dateList, todayStr]);

  // Navigation handlers per view mode
  const handlePrev = () => {
    if (viewMode === "month") {
      setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      setAnchorDate((prev) => addDays(prev, -7));
    } else {
      setAnchorDate((prev) => addDays(prev, -14));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      setAnchorDate((prev) => addDays(prev, 7));
    } else {
      setAnchorDate((prev) => addDays(prev, 14));
    }
  };

  const handleGoToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAnchorDate(d);
  };

  // Find index of today in dateList if visible
  const todayIndex = useMemo(() => {
    return dateList.findIndex((d) => formatDateYMD(d) === todayStr);
  }, [dateList, todayStr]);

  // Grouped project and stage data (with smart time-window intersection filtering)
  const projectGroups = useMemo<ProjectGroupItem[]>(() => {
    const isAllView = selectedProjectId === "all";
    const targetProjects = isAllView
      ? projects.filter((p) => p.status !== "archived")
      : projects.filter((p) => p.id === selectedProjectId);

    const windowStartMs = windowStartDate.getTime();
    const windowEndMs = windowEndDate.getTime() + 86400000 - 1;

    const groups: ProjectGroupItem[] = [];

    for (const proj of targetProjects) {
      const projStages = stages
        .filter((s) => s.projectId === proj.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const projTasks = tasks.filter((t) => t.projectId === proj.id);

      const stagesWithMeta: StageItemWithMeta[] = projStages.map((stage) => {
        const stageTasks = projTasks.filter((t) => t.projectStageId === stage.id);
        const taskStartTimes = stageTasks
          .map((t) => t.scheduledStartAt || t.scheduledEndAt)
          .filter((t): t is number => Boolean(t));
        const taskEndTimes = stageTasks
          .map((t) => t.scheduledEndAt || t.scheduledStartAt)
          .filter((t): t is number => Boolean(t));

        let start = parseDateStr(stage.startDate);
        let end = parseDateStr(stage.endDate);

        if (!start && taskStartTimes.length > 0) {
          start = new Date(Math.min(...taskStartTimes));
        }
        if (!end && taskEndTimes.length > 0) {
          end = new Date(Math.max(...taskEndTimes));
        }

        if (start && !end) end = new Date(start);
        if (!start && end) start = new Date(end);
        if (start && end && end < start) end = new Date(start);

        const hasSchedule = Boolean(start && end);
        const stageStartMs = start ? start.getTime() : null;
        const stageEndMs = end ? end.getTime() + 86400000 - 1 : null;

        const hasTaskInWindow = stageTasks.some((t) => {
          const tStart = t.scheduledStartAt || t.scheduledEndAt;
          const tEnd = t.scheduledEndAt || t.scheduledStartAt;
          if (!tStart || !tEnd) return false;
          return tStart <= windowEndMs && tEnd >= windowStartMs;
        });

        const intersectsWindow =
          (stageStartMs !== null && stageEndMs !== null && stageStartMs <= windowEndMs && stageEndMs >= windowStartMs) ||
          hasTaskInWindow;

        return {
          id: stage.id,
          projectId: stage.projectId,
          projectName: proj.name,
          name: stage.name,
          sortOrder: stage.sortOrder,
          startDate: stage.startDate,
          endDate: stage.endDate,
          computedStart: start ?? undefined,
          computedEnd: end ?? undefined,
          hasSchedule,
          intersectsWindow,
          tasks: stageTasks,
        };
      });

      // Filter stages:
      // When in "all" view: only keep stages intersecting the current window
      // When in single project view: keep all stages so user can inspect or schedule them
      const visibleStages = isAllView
        ? stagesWithMeta.filter((s) => s.intersectsWindow)
        : stagesWithMeta;

      // Project date bounds
      const allStageStarts = stagesWithMeta
        .map((s) => (s.computedStart ? s.computedStart.getTime() : null))
        .filter((t): t is number => Boolean(t));
      const allStageEnds = stagesWithMeta
        .map((s) => (s.computedEnd ? s.computedEnd.getTime() : null))
        .filter((t): t is number => Boolean(t));

      let projStart: Date | undefined;
      let projEnd: Date | undefined;

      if (proj.startDate) projStart = parseDateStr(proj.startDate) ?? undefined;
      else if (allStageStarts.length > 0) projStart = new Date(Math.min(...allStageStarts));

      if (proj.endDate) projEnd = parseDateStr(proj.endDate) ?? undefined;
      else if (allStageEnds.length > 0) projEnd = new Date(Math.max(...allStageEnds));

      const projStartMs = projStart ? projStart.getTime() : null;
      const projEndMs = projEnd ? projEnd.getTime() + 86400000 - 1 : null;

      const projIntersects =
        (projStartMs !== null && projEndMs !== null && projStartMs <= windowEndMs && projEndMs >= windowStartMs) ||
        visibleStages.length > 0;

      // If in all view and project has no intersecting stages, skip project
      if (isAllView && !projIntersects && visibleStages.length === 0) {
        continue;
      }

      const completedTasksCount = projTasks.filter((t) => t.completed).length;

      groups.push({
        project: proj,
        stages: visibleStages,
        tasks: projTasks,
        computedStart: projStart,
        computedEnd: projEnd,
        completedTasksCount,
        totalTasksCount: projTasks.length,
      });
    }

    return groups;
  }, [projects, stages, tasks, selectedProjectId, windowStartDate, windowEndDate]);

  const totalStagesCount = useMemo(() => {
    return projectGroups.reduce((acc, g) => acc + g.stages.length, 0);
  }, [projectGroups]);

  // Tasks falling on / intersecting Today
  const todayHitCount = useMemo(() => {
    const targetTasks =
      selectedProjectId === "all"
        ? tasks.filter((t) => Boolean(t.projectId))
        : tasks.filter((t) => t.projectId === selectedProjectId);

    return targetTasks.filter((t) => taskIntersectsDay(t, todayDate)).length;
  }, [tasks, selectedProjectId, todayDate]);

  // Calculate Bar Spans (supporting intra-day deadlines from 00:00 to end time, and multi-day spans)
  const calculateBarSpan = (
    startVal?: string | number | Date | null,
    endVal?: string | number | Date | null,
    isTaskItem?: boolean
  ) => {
    const rawEndTime = typeof endVal === "number" ? endVal : endVal instanceof Date ? endVal.getTime() : null;
    const rawStartTime = typeof startVal === "number" ? startVal : startVal instanceof Date ? startVal.getTime() : null;

    const startDay = getLocalDayMidnight(startVal) || getLocalDayMidnight(endVal);
    const endDay = getLocalDayMidnight(endVal) || getLocalDayMidnight(startVal);

    if (!startDay || !endDay) return null;

    const windowStartMs = windowStartDate.getTime();
    const dayMs = 86400000;

    const isSameDay = startDay.getTime() === endDay.getTime();

    let startOffsetDays: number;
    let endOffsetDays: number;

    if (isSameDay && isTaskItem) {
      // Single day task (normalized from 00:00 of the day to the deadline timestamp)
      const effectiveStartDayMs = startDay.getTime();
      startOffsetDays = Math.round((effectiveStartDayMs - windowStartMs) / dayMs);

      const targetEndMs = rawEndTime || rawStartTime || effectiveStartDayMs;
      const targetEndDate = new Date(targetEndMs);
      const hours = targetEndDate.getHours();
      const minutes = targetEndDate.getMinutes();

      if (hours === 0 && minutes === 0) {
        // Full day task
        endOffsetDays = startOffsetDays + 1;
      } else {
        // Intra-day fractional deadline: from 00:00 to target time (e.g. 12:00 -> 0.5 day)
        const fraction = (hours * 3600 + minutes * 60 + targetEndDate.getSeconds()) / 86400;
        // Minimum visual width (at least 20% of a day column)
        const effectiveFraction = Math.max(0.2, fraction);
        endOffsetDays = startOffsetDays + effectiveFraction;
      }
    } else {
      // Multi-day range (Stage, Project, or Multi-day Task)
      const effectiveStart = startDay.getTime() <= endDay.getTime() ? startDay : endDay;
      const effectiveEnd = startDay.getTime() <= endDay.getTime() ? endDay : startDay;

      startOffsetDays = Math.round((effectiveStart.getTime() - windowStartMs) / dayMs);
      endOffsetDays = Math.round((effectiveEnd.getTime() - windowStartMs) / dayMs) + 1; // +1 to encompass the full end day
    }

    const clampedStart = Math.max(0, startOffsetDays);
    const clampedEnd = Math.min(totalDays, endOffsetDays);

    if (clampedEnd <= 0 || clampedStart >= totalDays || clampedEnd <= clampedStart) {
      return null;
    }

    const leftPct = (clampedStart / totalDays) * 100;
    const widthPct = Math.max(
      viewMode === "month" ? 1.5 : 2.0,
      ((clampedEnd - clampedStart) / totalDays) * 100
    );

    return {
      leftPct,
      widthPct,
      sTime: startDay.getTime(),
      eTime: endDay.getTime(),
    };
  };

  // Interaction Handlers (Pure Inline Tree & Navigation)
  const handleStageClick = (stageId: string) => {
    toggleStageCollapse(stageId);
  };

  const handleStageDoubleClick = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveProjectId(projectId);
    void navigate({ to: "/projects" });
  };

  const handleProjectDoubleClick = (projectId: string) => {
    setActiveProjectId(projectId);
    void navigate({ to: "/projects" });
  };

  const handleToggleTask = async (task: ProjectTask) => {
    await saveTask({ ...task, completed: !task.completed } as Task);
  };

  const handleTrackCellClick = (
    stage: {
      id: string;
      projectId: string;
      name: string;
    },
    dayDate: Date,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const anchorEl = e.currentTarget as HTMLElement;
    const targetTime = dayDate.getTime();
    const dummyTask: Task = {
      id: createTaskId(),
      title: "",
      completed: false,
      projectId: stage.projectId,
      projectStageId: stage.id,
      quadrant: "Q2",
      priority: "high",
      scheduledStartAt: targetTime,
      scheduledEndAt: targetTime,
      scheduleMode: "range",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    void openQuickEditWindow({
      task: dummyTask,
      anchorEl,
      onCommit: (_id, updates) => {
        void saveTask({ ...dummyTask, ...updates });
      },
      onClosed: () => {},
    });
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* ===== 1. 看板表格外的左上角标题与今日命中任务统计 ===== */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          {isPixelTheme ? (
            <PixelScroll size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <span className="size-2 rounded-2xs bg-emerald-500 shrink-0" />
          )}
          <span className={isPixelTheme ? "font-mono font-bold" : "font-bold text-sm"}>
            {isPixelTheme ? "项目推进时间线" : "项目推进时间线"}
          </span>
          <span className="font-semibold text-muted-foreground tabular-nums text-xs">
            {todayHitCount} 项任务
          </span>
        </div>
      </div>

      {/* ===== 2. 看板表格容器 ===== */}
      <section
        className={cn(
          "flex flex-col bg-card overflow-hidden transition-all shadow-xs",
          isPixelTheme
            ? "rounded-xs border-2 border-border/90 shadow-[3px_3px_0px_rgba(0,0,0,0.08)] font-mono"
            : "rounded-2xl border border-border"
        )}
      >
        {/* Top Controls Bar: 左侧(项目筛选 + 周期导航), 右侧(视图刻度切换) */}
        <header
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 p-3 border-b select-none",
            isPixelTheme
              ? "border-b-2 border-border/90 bg-amber-50/30 dark:bg-amber-950/30 font-mono"
              : "border-border bg-muted/20"
          )}
        >
          {/* Left Side: 周期导航(左) + 项目筛选器(右) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 周期导航 */}
            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 text-xs",
                isPixelTheme
                  ? "rounded-xs border-2 border-border bg-muted/60 font-mono shadow-[1px_1px_0px_#000]"
                  : "rounded-lg border border-border/80 bg-background shadow-2xs"
              )}
            >
              <Button
                size="icon"
                variant="ghost"
                onClick={handlePrev}
                className={cn("size-6 cursor-pointer p-0", isPixelTheme && "rounded-xs")}
                title="向前切换周期"
              >
                <ChevronLeft size={14} />
              </Button>

              <span className="font-semibold text-xs tabular-nums text-foreground px-1 min-w-[130px] text-center">
                {formatRangeLabel(viewMode, windowStartDate, windowEndDate)}
              </span>

              <Button
                size="icon"
                variant="ghost"
                onClick={handleNext}
                className={cn("size-6 cursor-pointer p-0", isPixelTheme && "rounded-xs")}
                title="向后切换周期"
              >
                <ChevronRight size={14} />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleGoToday}
                className={cn(
                  "h-6 px-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer ml-0.5",
                  isPixelTheme ? "rounded-xs font-mono" : "rounded"
                )}
              >
                今天
              </Button>
            </div>

            {/* 项目筛选器 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProjectDropdownOpen(!projectDropdownOpen);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  isPixelTheme
                    ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted font-mono"
                    : "rounded-lg border border-border/80 bg-background hover:bg-accent shadow-2xs text-foreground"
                )}
              >
                <FolderKanban className="size-3.5 text-sky-500" />
                <span className="max-w-[130px] truncate font-medium">
                  {selectedProjectId === "all" ? "全部项目" : currentProject?.name ?? "选择项目"}
                </span>
                <ChevronDown className="size-3 opacity-60 text-muted-foreground" />
              </button>

              {projectDropdownOpen && (
                <div
                  className={cn(
                    "absolute left-0 top-full mt-1.5 z-50 min-w-44 border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95",
                    isPixelTheme ? "rounded-xs border-2 border-border shadow-[3px_3px_0px_#000] font-mono" : "rounded-xl"
                  )}
                  onMouseLeave={() => setProjectDropdownOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProjectId("all");
                      setProjectDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer",
                      isPixelTheme ? "rounded-xs" : "rounded-lg",
                      selectedProjectId === "all"
                        ? "bg-accent font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="truncate font-medium">全部项目</span>
                  </button>
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setProjectDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer",
                        isPixelTheme ? "rounded-xs" : "rounded-lg",
                        selectedProjectId === proj.id
                          ? "bg-accent font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{proj.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: 视图刻度切换器 (周视图 / 双周视图 / 月视图) */}
          <div
            className={cn(
              "flex items-center gap-0.5 p-0.5 border text-xs select-none",
              isPixelTheme
                ? "rounded-xs border-border bg-muted/60 font-mono shadow-[1px_1px_0px_#000]"
                : "rounded-lg border-border/70 bg-muted/40"
            )}
          >
            {(["week", "biweekly", "month"] as TimelineViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                  isPixelTheme ? "rounded-xs font-mono" : "rounded-md",
                  viewMode === mode
                    ? isPixelTheme
                      ? "bg-amber-400 text-amber-950 font-bold border border-amber-800 shadow-[1px_1px_0px_#000]"
                      : "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {VIEW_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </header>

        {/* Main Gantt Body */}
        {projectGroups.length === 0 || totalStagesCount === 0 ? (
          <div className={cn("py-12 text-center text-xs text-muted-foreground", isPixelTheme && "font-mono")}>
            {isPixelTheme ? (
              <PixelScroll className="mx-auto mb-2 text-amber-600 dark:text-amber-400 opacity-70" size={28} />
            ) : (
              <FolderKanban className="mx-auto mb-2 size-7 opacity-40 text-muted-foreground" />
            )}
            <span>
              {isPixelTheme
                ? `当前时间视图（${VIEW_MODE_LABELS[viewMode]}）暂无公会战役排期，可在「项目中心」配置`
                : `当前时间视图（${VIEW_MODE_LABELS[viewMode]}）内暂无排期阶段。可在「项目中心」为阶段配置时间周期。`}
            </span>
          </div>
        ) : (
          <div className="flex flex-col min-h-[340px] max-h-[560px] overflow-hidden">
            {/* 1. Fixed Header Row: 左侧表头与右侧日期表头永远固定在顶部，不随纵向滚动条滚动 */}
            <div
              className={cn(
                "flex shrink-0 select-none border-b",
                isPixelTheme
                  ? "border-b-2 border-border/90 bg-amber-100/40 dark:bg-amber-950/40 font-mono"
                  : "border-border bg-muted/40"
              )}
            >
              {/* Left Column Header (固定宽度，无纵向滚动) */}
              <div className="w-64 sm:w-72 shrink-0 h-10 px-3 border-r border-border/60 flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>{selectedProjectId === "all" ? "项目与阶段" : "阶段与任务项"}</span>
                <span>进度 / 状态</span>
              </div>

              {/* Right Column Header (与时间轴横向滚动联动) */}
              <div
                ref={headerScrollRef}
                className="flex-1 h-10 flex overflow-x-hidden min-w-0"
              >
                <div
                  className="flex shrink-0 w-full"
                  style={{ minWidth: `${Math.max(600, totalDays * (viewMode === "month" ? 30 : 36))}px` }}
                >
                  {timelineDays.map((day) => (
                    <div
                      key={day.dateStr}
                      className={cn(
                        "flex-1 min-w-[30px] sm:min-w-[36px] flex flex-col items-center justify-center border-r border-border/50 text-[10px]",
                        day.isToday
                          ? isPixelTheme
                            ? "bg-amber-300/60 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-bold"
                            : "bg-primary/10 text-primary font-bold"
                          : day.isWeekend
                          ? "bg-muted/30 text-muted-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      <span className="text-[9px] opacity-75">{day.weekdayName}</span>
                      <span className="font-bold text-[11px]">{day.dayNum}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Scrollable Body Area: 左侧无滚动条(overflow-hidden)，右侧拥有唯一垂直与横向滚动条 */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left Column: Stage & Task Tree (无自身滚动条，滚轮联动右侧) */}
              <div
                ref={leftScrollRef}
                onWheel={handleLeftWheel}
                className={cn(
                  "w-64 sm:w-72 shrink-0 border-r border-border/60 overflow-hidden select-none bg-card",
                  isPixelTheme && "font-mono"
                )}
              >
                <div className="divide-y divide-border/60">
                  {projectGroups.map((group) => {
                    const isProjCollapsed = collapsedProjects[group.project.id];
                    const isAllView = selectedProjectId === "all";

                    return (
                      <div key={`group-${group.project.id}`} className="flex flex-col">
                        {/* 如果是全部项目模式：渲染项目行 (Project Row) */}
                        {isAllView && (
                          <div
                            onClick={() => toggleProjectCollapse(group.project.id)}
                            onDoubleClick={() => handleProjectDoubleClick(group.project.id)}
                            className={cn(
                              "h-9 px-2.5 flex items-center justify-between cursor-pointer transition-colors group select-none border-b border-border/40",
                              isPixelTheme
                                ? "bg-amber-100/50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 font-mono"
                                : "bg-muted/40 hover:bg-muted/70"
                            )}
                            title={`【项目】${group.project.name}\n📊 完成进度：${group.completedTasksCount}/${group.totalTasksCount} 项\n💡 单击折叠/展开项目 · 双击直达项目中心`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleProjectCollapse(group.project.id);
                                }}
                                className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {isProjCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                              </button>
                              <FolderKanban className="size-3.5 text-sky-500 shrink-0" />
                              <span className={cn("text-xs font-black truncate text-foreground", isPixelTheme && "font-mono")}>
                                {group.project.name}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-[11px] tabular-nums shrink-0 font-semibold",
                                isPixelTheme
                                  ? "px-1.5 py-0.2 text-[10px] font-mono font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-700/50 rounded-xs shadow-[1px_1px_0px_#000]"
                                  : "text-muted-foreground"
                              )}
                            >
                              {group.completedTasksCount}/{group.totalTasksCount}
                            </span>
                          </div>
                        )}

                        {/* 阶段列表 (Stage Rows) */}
                        {(!isAllView || !isProjCollapsed) &&
                          group.stages.map((stage, sIdx) => {
                            const stageTasks = stage.tasks;
                            const completedCount = stageTasks.filter((t) => t.completed).length;
                            const isCollapsed = collapsedStages[stage.id];
                            const isStageAllDone = stageTasks.length > 0 && completedCount === stageTasks.length;
                            const isHoveredAura = hoveredStageId === stage.id;

                            return (
                              <div
                                key={stage.id}
                                className={cn("flex flex-col transition-colors", isHoveredAura && "bg-muted/20")}
                                onMouseEnter={() => setHoveredStageId(stage.id)}
                                onMouseLeave={() => setHoveredStageId(null)}
                              >
                                {/* Stage Row Header */}
                                <div
                                  onClick={() => handleStageClick(stage.id)}
                                  onDoubleClick={(e) => handleStageDoubleClick(stage.projectId, e)}
                                  className={cn(
                                    "h-9 pr-2.5 flex items-center justify-between cursor-pointer transition-colors group select-none",
                                    isAllView ? "pl-6" : "pl-2.5",
                                    isHoveredAura
                                      ? isPixelTheme
                                        ? "bg-amber-50/60 dark:bg-amber-950/40"
                                        : "bg-muted/50 text-foreground"
                                      : isStageAllDone
                                      ? isPixelTheme
                                        ? "bg-emerald-100/60 dark:bg-emerald-950/40 hover:bg-emerald-200/60"
                                        : "bg-emerald-500/10 hover:bg-emerald-500/15"
                                      : isPixelTheme
                                      ? "bg-muted/40 hover:bg-muted/70"
                                      : "bg-muted/30 hover:bg-muted/60"
                                  )}
                                  title={`【阶段】${stage.name} (${group.project.name})\n📅 排期周期：${stage.computedStart && stage.computedEnd ? `${formatShortDate(stage.computedStart)} - ${formatShortDate(stage.computedEnd)}` : "未排期"}\n📊 阶段进度：${completedCount}/${stageTasks.length} 项\n💡 单击展开/折叠任务项 · 双击直达项目中心`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStageCollapse(stage.id);
                                      }}
                                      className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    </button>

                                    <span
                                      className={cn(
                                        "size-4 flex items-center justify-center text-[9px] font-black shrink-0",
                                        isStageAllDone
                                          ? "rounded-xs bg-emerald-600 text-white font-mono"
                                          : isPixelTheme
                                          ? "rounded-xs bg-amber-500 text-amber-950 font-mono"
                                          : "rounded-full bg-primary text-primary-foreground"
                                      )}
                                    >
                                      {isStageAllDone ? "✓" : sIdx + 1}
                                    </span>

                                    <span
                                      className={cn(
                                        "text-xs font-bold truncate text-foreground",
                                        isPixelTheme && "font-mono"
                                      )}
                                    >
                                      {stage.name}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                                    <span
                                      className={cn(
                                        isPixelTheme && "px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-xs border shadow-[1px_1px_0px_#000]",
                                        isStageAllDone
                                          ? isPixelTheme
                                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-700/50"
                                            : "text-emerald-700 dark:text-emerald-300 font-bold"
                                          : isPixelTheme
                                          ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-700/50"
                                          : ""
                                      )}
                                    >
                                      {completedCount}/{stageTasks.length}
                                    </span>
                                  </div>
                                </div>

                                {/* 展开阶段后的具体任务项 (Task Rows) */}
                                {!isCollapsed && (
                                  <div className="divide-y divide-border/30">
                                    {stageTasks.map((task) => {
                                      const isTaskHovered = hoveredTaskId === task.id;
                                      return (
                                        <div
                                          key={task.id}
                                          onMouseEnter={() => setHoveredTaskId(task.id)}
                                          onMouseLeave={() => setHoveredTaskId(null)}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void openQuickEditWindow({
                                              task,
                                              anchorEl: e.currentTarget,
                                              onCommit: (taskId, updates) => {
                                                void saveTask({ ...task, ...updates, id: taskId });
                                              },
                                              onClosed: () => {},
                                            });
                                          }}
                                          className={cn(
                                            "h-8.5 pr-3 flex items-center justify-between cursor-pointer transition-all group select-none",
                                            isAllView ? "pl-11" : "pl-7",
                                            isTaskHovered
                                              ? isPixelTheme
                                                ? "bg-amber-100/70 dark:bg-amber-950/70 font-semibold"
                                                : "bg-muted/80 font-medium"
                                              : task.completed
                                              ? "opacity-60 bg-card hover:opacity-100 hover:bg-accent/40"
                                              : "hover:bg-accent/50"
                                          )}
                                          title={`【任务】${task.title}\n⏱️ 状态：${task.completed ? "已完成" : "进行中"}\n💡 点击快速编辑任务详情与排期`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void handleToggleTask(task);
                                              }}
                                              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                            >
                                              {task.completed ? (
                                                <CheckCircle2 size={13} className="text-emerald-600 fill-emerald-600/20" />
                                              ) : (
                                                <Circle size={13} />
                                              )}
                                            </button>
                                            <span
                                              className={cn(
                                                "text-xs truncate",
                                                task.completed && "line-through text-muted-foreground",
                                                isPixelTheme && "font-mono"
                                              )}
                                            >
                                              {task.title}
                                            </span>
                                          </div>

                                          {task.assigneeName && (
                                            <span className="text-[10px] text-muted-foreground/80 bg-muted px-1 py-0.2 rounded shrink-0 ml-1">
                                              {task.assigneeName}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {stageTasks.length === 0 && (
                                      <div
                                        onClick={(e) => handleTrackCellClick(stage, todayDate, e)}
                                        className={cn(
                                          "h-8 pr-3 flex items-center text-[11px] text-muted-foreground/60 italic hover:text-primary cursor-pointer",
                                          isAllView ? "pl-11" : "pl-8"
                                        )}
                                      >
                                        + 点击添加任务
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Timeline Grid & Schedule Bars (拥有唯一滚动条，驱动左侧垂直滚动与顶部横向滚动) */}
              <div
                ref={rightScrollRef}
                onScroll={handleRightScroll}
                className="flex-1 overflow-auto min-w-0 relative"
              >
                <div
                  className="divide-y divide-border/60 relative w-full"
                  style={{ minWidth: `${Math.max(600, totalDays * (viewMode === "month" ? 30 : 36))}px` }}
                >
                  {/* Vertical Guide Line for Today */}
                  {todayIndex >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none z-20"
                      style={{
                        left: `${((todayIndex + 0.5) / totalDays) * 100}%`,
                        width: "1.5px",
                      }}
                    >
                      <div
                        className={cn(
                          "w-[1.5px] h-full",
                          isPixelTheme
                            ? "bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                            : "bg-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                        )}
                      />
                    </div>
                  )}

                  {projectGroups.map((group) => {
                    const isProjCollapsed = collapsedProjects[group.project.id];
                    const isAllView = selectedProjectId === "all";
                    const projSpan = calculateBarSpan(group.computedStart, group.computedEnd);

                    return (
                      <div key={`track-group-${group.project.id}`} className="flex flex-col">
                        {/* 如果是全部项目模式：渲染项目轨道 (Project Track Row) */}
                        {isAllView && (
                          <div
                            className={cn(
                              "h-9 relative flex items-center border-b border-border/40",
                              isPixelTheme ? "bg-amber-50/20 dark:bg-amber-950/20" : "bg-muted/20"
                            )}
                          >
                            <div className="absolute inset-0 flex pointer-events-none">
                              {timelineDays.map((day) => (
                                <div
                                  key={day.dateStr}
                                  className={cn(
                                    "flex-1 min-w-[30px] sm:min-w-[36px] border-r border-border/20 h-full",
                                    day.isToday && "bg-amber-400/5",
                                    day.isWeekend && "bg-muted/10"
                                  )}
                                />
                              ))}
                            </div>
                            {projSpan && (
                              <div
                                onClick={() => toggleProjectCollapse(group.project.id)}
                                onDoubleClick={() => handleProjectDoubleClick(group.project.id)}
                                className={cn(
                                  "absolute h-5.5 px-2 flex items-center justify-between text-[10px] font-semibold transition-all z-10 select-none cursor-pointer overflow-hidden",
                                  isPixelTheme
                                    ? "bg-sky-950/90 text-sky-200 border-2 border-sky-600 font-mono rounded-xs shadow-[2px_2px_0px_#000]"
                                    : "bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/50 hover:bg-sky-500/30 rounded-full shadow-2xs opacity-90"
                                )}
                                style={{
                                  left: `${projSpan.leftPct}%`,
                                  width: `${projSpan.widthPct}%`,
                                }}
                                title={`【项目】${group.project.name}\n📅 整体周期：${group.computedStart ? formatShortDate(group.computedStart) : ""} - ${group.computedEnd ? formatShortDate(group.computedEnd) : ""}\n📊 完成进度：${group.completedTasksCount}/${group.totalTasksCount} 项\n💡 单击折叠/展开项目 · 双击直达项目中心`}
                              >
                                {/* Inner Project Progress Fill */}
                                {group.totalTasksCount > 0 && group.completedTasksCount > 0 && (
                                  <div
                                    className={cn(
                                      "absolute left-0 top-0 bottom-0 pointer-events-none",
                                      isPixelTheme
                                        ? "bg-sky-500/40 border-r-2 border-sky-400"
                                        : "bg-sky-500/25 rounded-full"
                                    )}
                                    style={{
                                      width: `${Math.round((group.completedTasksCount / group.totalTasksCount) * 100)}%`,
                                    }}
                                  />
                                )}

                                <span className="truncate z-10 font-bold">{group.project.name}</span>
                                <span className="text-[9px] tabular-nums shrink-0 ml-1 font-bold z-10">
                                  {group.totalTasksCount > 0
                                    ? `${Math.round((group.completedTasksCount / group.totalTasksCount) * 100)}%`
                                    : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 阶段轨道 (Stage Tracks) */}
                        {(!isAllView || !isProjCollapsed) &&
                          group.stages.map((stage) => {
                            const stageTasks = stage.tasks;
                            const isCollapsed = collapsedStages[stage.id];
                            const isStageAllDone = stageTasks.length > 0 && stageTasks.every((t) => t.completed);
                            const isHoveredAura = hoveredStageId === stage.id;

                            const stageSpan = calculateBarSpan(stage.computedStart, stage.computedEnd);
                            const completedTasksCount = stageTasks.filter((t) => t.completed).length;
                            const stageProgress =
                              stageTasks.length > 0 ? Math.round((completedTasksCount / stageTasks.length) * 100) : 0;

                            return (
                              <div
                                key={`track-stage-${stage.id}`}
                                className={cn("flex flex-col transition-colors", isHoveredAura && "bg-muted/20")}
                                onMouseEnter={() => setHoveredStageId(stage.id)}
                                onMouseLeave={() => setHoveredStageId(null)}
                              >
                                {/* Stage Track Row */}
                                <div
                                  className={cn(
                                    "h-9 relative flex items-center transition-colors",
                                    isHoveredAura
                                      ? isPixelTheme
                                        ? "bg-amber-50/30 dark:bg-amber-950/20"
                                        : "bg-muted/40"
                                      : isPixelTheme
                                      ? isStageAllDone
                                        ? "bg-emerald-100/30 dark:bg-emerald-950/20"
                                        : "bg-muted/20"
                                      : isStageAllDone
                                      ? "bg-emerald-500/5"
                                      : "bg-muted/10"
                                  )}
                                >
                                  {/* Vertical Grid Lines & Click-to-Schedule */}
                                  <div className="absolute inset-0 flex pointer-events-none">
                                    {timelineDays.map((day) => (
                                      <div
                                        key={day.dateStr}
                                        onClick={(e) => handleTrackCellClick(stage, day.date, e)}
                                        className={cn(
                                          "flex-1 min-w-[30px] sm:min-w-[36px] border-r border-border/30 h-full pointer-events-auto hover:bg-emerald-500/10 cursor-pointer transition-colors",
                                          day.isToday && "bg-amber-400/10 dark:bg-amber-600/10",
                                          day.isWeekend && "bg-muted/20"
                                        )}
                                        title={`点击在 ${day.dateStr} 为「${stage.name}」创建任务`}
                                      />
                                    ))}
                                  </div>

                                  {/* Stage Progress Bar */}
                                  {stageSpan && (
                                    <div
                                      onClick={() => handleStageClick(stage.id)}
                                      onDoubleClick={(e) => handleStageDoubleClick(stage.projectId, e)}
                                      className={cn(
                                        "absolute h-6 px-2 flex items-center justify-between text-xs transition-all z-10 select-none cursor-pointer overflow-hidden",
                                        isPixelTheme ? "rounded-xs font-mono" : "rounded shadow-xs",
                                        isStageAllDone
                                          ? isPixelTheme
                                            ? "bg-emerald-700 text-white font-bold border-2 border-emerald-900 shadow-[2px_2px_0px_#064e3b]"
                                            : "bg-emerald-600 text-white font-semibold shadow-xs"
                                          : isPixelTheme
                                          ? "bg-amber-200 dark:bg-amber-950 text-amber-950 dark:text-amber-100 border-2 border-amber-800 shadow-[2px_2px_0px_#000]"
                                          : "bg-secondary text-secondary-foreground border border-border/80"
                                      )}
                                      style={{
                                        left: `${stageSpan.leftPct}%`,
                                        width: `${stageSpan.widthPct}%`,
                                      }}
                                      title={`【阶段】${stage.name} (${group.project.name})\n📅 排期周期：${stage.computedStart && stage.computedEnd ? `${formatShortDate(stage.computedStart)} - ${formatShortDate(stage.computedEnd)}` : "未排期"}\n📊 阶段进度：${stageProgress}% (${completedTasksCount}/${stageTasks.length})\n💡 单击展开/折叠任务项 · 双击直达项目中心`}
                                    >
                                      {/* Inner Progress Fill */}
                                      {!isStageAllDone && stageProgress > 0 && (
                                        <div
                                          className={cn(
                                            "absolute left-0 top-0 bottom-0 pointer-events-none",
                                            isPixelTheme
                                              ? "bg-amber-500/50 dark:bg-amber-400/40 border-r-2 border-amber-700"
                                              : "bg-primary/25 rounded"
                                          )}
                                          style={{ width: `${stageProgress}%` }}
                                        />
                                      )}

                                      <div className="flex items-center gap-1.5 min-w-0 truncate z-10 pr-1">
                                        <span className="font-bold text-xs truncate">{stage.name}</span>
                                        {isStageAllDone && <span className="text-[10px]">✓</span>}
                                      </div>

                                      <span className="text-[10px] font-bold opacity-80 z-10 tabular-nums shrink-0">
                                        {stageProgress}%
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Task Tracks under Stage */}
                                {!isCollapsed &&
                                  stageTasks.map((task) => {
                                    const taskSpan = calculateBarSpan(
                                      task.scheduledStartAt || task.scheduledEndAt,
                                      task.scheduledEndAt || task.scheduledStartAt,
                                      true
                                    );

                                    const taskEndMs = task.scheduledEndAt || task.scheduledStartAt;
                                    const taskEndDate = taskEndMs ? new Date(taskEndMs) : null;
                                    const hasSpecificTime = taskEndDate && (taskEndDate.getHours() !== 0 || taskEndDate.getMinutes() !== 0);

                                    return (
                                      <div
                                        key={`task-track-${task.id}`}
                                        className="h-8.5 relative flex items-center bg-card/60"
                                      >
                                        {/* Vertical Grid Lines & Click-to-Schedule */}
                                        <div className="absolute inset-0 flex pointer-events-none">
                                          {timelineDays.map((day) => (
                                            <div
                                              key={day.dateStr}
                                              onClick={(e) => handleTrackCellClick(stage, day.date, e)}
                                              className={cn(
                                                "flex-1 min-w-[30px] sm:min-w-[36px] border-r border-border/20 h-full pointer-events-auto hover:bg-emerald-500/10 cursor-pointer transition-colors",
                                                day.isToday && "bg-amber-400/5",
                                                day.isWeekend && "bg-muted/10"
                                              )}
                                              title={`点击在 ${day.dateStr} 为「${stage.name}」创建任务`}
                                            />
                                          ))}
                                        </div>

                                        {/* Task Bar */}
                                        {taskSpan ? (
                                          <div
                                            onMouseEnter={() => setHoveredTaskId(task.id)}
                                            onMouseLeave={() => setHoveredTaskId(null)}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void openQuickEditWindow({
                                                task,
                                                anchorEl: e.currentTarget,
                                                onCommit: (taskId, updates) => {
                                                  void saveTask({ ...task, ...updates, id: taskId });
                                                },
                                                onClosed: () => {},
                                              });
                                            }}
                                            className={cn(
                                              "absolute h-5 rounded px-2 flex items-center justify-between text-[10px] font-medium transition-all z-10 select-none cursor-pointer shadow-2xs truncate",
                                              hoveredTaskId === task.id && "ring-2 ring-amber-500 scale-[1.03] shadow-md z-30 animate-pulse",
                                              task.completed
                                                ? isPixelTheme
                                                  ? "bg-emerald-800/60 text-emerald-100 line-through border border-emerald-900"
                                                  : "bg-emerald-600/80 text-white line-through opacity-80"
                                                : isPixelTheme
                                                ? "bg-amber-400 text-amber-950 font-bold border border-amber-800 shadow-[1px_1px_0px_#000]"
                                                : "bg-primary/80 text-primary-foreground hover:bg-primary"
                                            )}
                                            style={{
                                              left: `${taskSpan.leftPct}%`,
                                              width: `${taskSpan.widthPct}%`,
                                            }}
                                            title={`【任务】${task.title}\n⏱️ 截止时间：${taskEndDate ? `${formatShortDate(taskEndDate)}${hasSpecificTime ? ` ${formatShortTime(taskEndDate)}` : ""}` : "无"}\n📊 状态：${task.completed ? "已完成" : "进行中"}\n💡 点击快速编辑任务详情与排期`}
                                          >
                                            <span className="truncate">{task.title}</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}

                                {!isCollapsed && stageTasks.length === 0 && (
                                  <div className="h-8 relative flex items-center bg-card/40">
                                    <div className="absolute inset-0 flex pointer-events-none">
                                      {timelineDays.map((day) => (
                                        <div key={day.dateStr} className="flex-1 min-w-[30px] sm:min-w-[36px] border-r border-border/20 h-full" />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
