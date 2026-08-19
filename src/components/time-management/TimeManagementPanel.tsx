import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LayoutGrid,
  Sun,
  CalendarRange,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Timer,
  SlidersHorizontal,
  Check,
  ChevronDown,
} from "lucide-react";
import { useTimeManagementData, useTaskActions } from "@/hooks/useTimeManagement";
import { Task, QuadrantType } from "@/types/timeManagement";
import { DailyQuadrants } from "./DailyQuadrants";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import {
  openQuickEditWindow,
} from "@/services/quickEditWindow";
import { startTaskReminderScheduler } from "@/services/taskReminderScheduler";
import { getTaskEndAt, taskIntersectsDay, taskIntersectsInterval, taskTimeLabel, sortTasksByQuadrantAndDeadline } from "@/lib/taskSchedule";
import { toggleFocusAssistant } from "@/services/focusAssistantWindow";
import { getTaskDescriptionText } from "@/lib/taskDescription";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export type ViewType = "quadrant" | "day" | "week" | "month";
export type StatusFilterType = "uncompleted" | "all" | "completed";
type ProjectTaskFilter = "non-project" | "all" | "project";

export const TimeManagementPanel: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const [activeView, setActiveView] = useState<ViewType>("quadrant");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("uncompleted");
  const [quadrantFilter, setQuadrantFilter] = useState<string>("ALL");
  const [projectTaskFilter, setProjectTaskFilter] = useState<ProjectTaskFilter>("non-project");

  const { data: tmData } = useTimeManagementData();
  const tasks = tmData?.tasks ?? [];

  const { addTask, updateTask, deleteTask } = useTaskActions();

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const cleanup = startTaskReminderScheduler(() => tasksRef.current);
    return cleanup;
  }, []);

  const handleOpenTaskEditor = (
    task?: Task,
    quadrant: QuadrantType = "Q2",
    anchorEl?: HTMLElement,
    initialDate?: string
  ) => {
    const targetEl = anchorEl || document.body;
    void openQuickEditWindow({
      task,
      quadrant,
      anchorEl: targetEl,
      onCommit: (taskId, updates) => {
        updateTask(taskId, updates);
      },
      onCreate: (targetQ, draft) => {
        const fallbackEndAt = initialDate
          ? new Date(`${initialDate}T23:59:59.999`).getTime()
          : undefined;
        addTask(draft.title, targetQ, {
          description: draft.description,
          scheduleMode: draft.scheduleMode ?? (fallbackEndAt ? "point" : undefined),
          scheduledStartAt: draft.scheduledStartAt,
          scheduledEndAt: draft.scheduledEndAt ?? fallbackEndAt,
          reminder: draft.reminder,
        });
      },
      onClosed: () => {},
    });
  };

  const handleToggleComplete = (taskId: string) => {
    const t = tasks.find((item) => item.id === taskId);
    if (!t) return;
    const nextCompleted = !t.completed;
    updateTask(taskId, {
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : undefined,
    });
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter === "uncompleted" && task.completed) return false;
      if (statusFilter === "completed" && !task.completed) return false;
      if (quadrantFilter !== "ALL" && task.quadrant !== quadrantFilter) return false;
      if (projectTaskFilter === "non-project" && task.projectId) return false;
      if (projectTaskFilter === "project" && !task.projectId) return false;
      return true;
    });
  }, [tasks, statusFilter, quadrantFilter, projectTaskFilter]);

  const periodTasks = useMemo(() => {
    if (activeView === "day") {
      return sortTasksByQuadrantAndDeadline(
        filteredTasks.filter((t) => taskIntersectsDay(t, currentDate))
      );
    }
    if (activeView === "week") {
      const d = new Date(currentDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sun.setHours(23, 59, 59, 999);
      return sortTasksByQuadrantAndDeadline(
        filteredTasks.filter((t) => taskIntersectsInterval(t, mon.getTime(), sun.getTime()))
      );
    }
    if (activeView === "month") {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return sortTasksByQuadrantAndDeadline(
        filteredTasks.filter((t) => taskIntersectsInterval(t, startOfMonth.getTime(), endOfMonth.getTime()))
      );
    }
    return [];
  }, [activeView, currentDate, filteredTasks]);

  const currentDateStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(currentDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [currentDate]);

  const handlePrevDate = () => {
    const d = new Date(currentDate);
    if (activeView === "day") d.setDate(d.getDate() - 1);
    else if (activeView === "week") d.setDate(d.getDate() - 7);
    else if (activeView === "month") d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(currentDate);
    if (activeView === "day") d.setDate(d.getDate() + 1);
    else if (activeView === "week") d.setDate(d.getDate() + 7);
    else if (activeView === "month") d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  const getLeftHeaderTitle = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const date = currentDate.getDate();
    const day = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][currentDate.getDay()];

    let titleText = "";
    if (activeView === "day") titleText = `${year}年${month}月${date}日 ${day}`;
    else if (activeView === "week") {
      const d = new Date(currentDate);
      const curDay = d.getDay();
      const diff = d.getDate() - curDay + (curDay === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      titleText = `${mon.getMonth() + 1}月${mon.getDate()}日 - ${sun.getMonth() + 1}月${sun.getDate()}日`;
    } else if (activeView === "month") {
      titleText = `${year}年 ${month}月`;
    }

    return (
      <div className="flex items-center gap-2">
        <span>{titleText}</span>
        {activeView === "day" && (
          <span className="text-muted-foreground font-medium text-xs">· 日任务时间轴</span>
        )}
      </div>
    );
  };

  const getSidebarTitle = () => {
    if (activeView === "day") return "当日任务概览";
    if (activeView === "week") return "本周任务概览";
    if (activeView === "month") return "本月任务概览";
    return "任务概览";
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden select-none">
      {/* Panel Header */}
      <header className="flex h-12 items-center justify-between gap-3 border-b border-border bg-card px-6 shrink-0 select-none">
        {/* View Switcher Tabs */}
        <div className={`flex items-center bg-muted p-0.5 ${isPixelTheme ? "rounded-xs font-mono" : "rounded-lg"} border border-border`}>
          <button
            onClick={() => setActiveView("quadrant")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-all cursor-pointer ${
              isPixelTheme ? "rounded-xs" : "rounded-md"
            } ${
              activeView === "quadrant"
                ? isPixelTheme
                  ? "bg-card text-foreground border border-border shadow-[1px_1px_0px_#000] font-bold"
                  : "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <LayoutGrid size={14} />
            <span>{isPixelTheme ? "四象限" : "四象限"}</span>
          </button>
          <button
            onClick={() => setActiveView("day")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-all cursor-pointer ${
              isPixelTheme ? "rounded-xs" : "rounded-md"
            } ${
              activeView === "day"
                ? isPixelTheme
                  ? "bg-card text-foreground border border-border shadow-[1px_1px_0px_#000] font-bold"
                  : "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <Sun size={14} />
            <span>日视图</span>
          </button>
          <button
            onClick={() => setActiveView("week")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-all cursor-pointer ${
              isPixelTheme ? "rounded-xs" : "rounded-md"
            } ${
              activeView === "week"
                ? isPixelTheme
                  ? "bg-card text-foreground border border-border shadow-[1px_1px_0px_#000] font-bold"
                  : "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <CalendarRange size={14} />
            <span>周视图</span>
          </button>
          <button
            onClick={() => setActiveView("month")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-all cursor-pointer ${
              isPixelTheme ? "rounded-xs" : "rounded-md"
            } ${
              activeView === "month"
                ? isPixelTheme
                  ? "bg-card text-foreground border border-border shadow-[1px_1px_0px_#000] font-bold"
                  : "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <CalendarIcon size={14} />
            <span>月视图</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void toggleFocusAssistant()}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              isPixelTheme
                ? "rounded-xs border-2 border-rose-800 bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 shadow-[1px_1px_0px_#000] font-mono"
                : "rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
            }`}
            title="显示或隐藏悬浮专注助手"
          >
            <Timer size={14} />
            <span>悬浮专注</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none",
                isPixelTheme
                  ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted font-mono shadow-[1px_1px_0px_#000]"
                  : "rounded-lg border border-border/80 bg-background hover:bg-accent shadow-2xs text-foreground"
              )}
              aria-label="筛选任务"
            >
              <SlidersHorizontal size={13} className={isPixelTheme ? "text-amber-600 dark:text-amber-400" : "text-sky-500"} />
              <span>筛选</span>
              <ChevronDown className="size-3 opacity-60 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                "w-60 gap-3 p-3",
                isPixelTheme
                  ? "rounded-xs border-2 border-border bg-popover font-mono shadow-[3px_3px_0px_#000]"
                  : "rounded-xl border border-border bg-popover shadow-lg"
              )}
              aria-label="任务筛选选项"
            >
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                <span className="text-muted-foreground text-[11px]">任务范围</span>
                <select
                  value={projectTaskFilter}
                  onChange={(event) => setProjectTaskFilter(event.target.value as ProjectTaskFilter)}
                  className={cn(
                    "h-8 px-2.5 text-xs font-medium outline-none bg-background text-foreground transition-colors cursor-pointer",
                    isPixelTheme
                      ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                      : "rounded-lg border border-border/80 bg-background hover:bg-accent focus:ring-1 focus:ring-ring"
                  )}
                >
                  <option value="non-project">仅非项目任务</option>
                  <option value="all">全部任务</option>
                  <option value="project">仅项目任务</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                <span className="text-muted-foreground text-[11px]">状态</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilterType)}
                  className={cn(
                    "h-8 px-2.5 text-xs font-medium outline-none bg-background text-foreground transition-colors cursor-pointer",
                    isPixelTheme
                      ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                      : "rounded-lg border border-border/80 bg-background hover:bg-accent focus:ring-1 focus:ring-ring"
                  )}
                >
                  <option value="uncompleted">未完成</option>
                  <option value="all">全部</option>
                  <option value="completed">已完成</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                <span className="text-muted-foreground text-[11px]">优先级</span>
                <select
                  value={quadrantFilter}
                  onChange={(event) => setQuadrantFilter(event.target.value)}
                  className={cn(
                    "h-8 px-2.5 text-xs font-medium outline-none bg-background text-foreground transition-colors cursor-pointer",
                    isPixelTheme
                      ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                      : "rounded-lg border border-border/80 bg-background hover:bg-accent focus:ring-1 focus:ring-ring"
                  )}
                >
                  <option value="ALL">全部</option>
                  <option value="Q1">Q1 · 重要且紧急</option>
                  <option value="Q2">Q2 · 重要不紧急</option>
                  <option value="Q3">Q3 · 紧急不重要</option>
                  <option value="Q4">Q4 · 不重要不紧急</option>
                </select>
              </label>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-hidden flex flex-col">
        {activeView === "quadrant" ? (
          <DailyQuadrants
            tasks={filteredTasks}
            onToggleComplete={handleToggleComplete}
            onCreateTask={(quadrant, anchorEl) =>
              handleOpenTaskEditor(undefined, quadrant, anchorEl)
            }
            hideCompleted={statusFilter === "uncompleted"}
            onDeleteTask={deleteTask}
            onEditTask={(task, anchorEl) =>
              handleOpenTaskEditor(task, task.quadrant, anchorEl)
            }
            onUpdateTask={updateTask}
          />
        ) : (
          <div className="flex-1 min-h-0 flex gap-3.5 items-stretch">
            {/* Left Panel: Card containing Date Navigation Header & Main View */}
            <div
              className={`min-w-0 flex-1 p-4 flex flex-col min-h-0 h-full overflow-hidden ${
                isPixelTheme
                  ? "bg-card rounded-xl border-2 border-border shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
                  : "bg-card rounded-2xl border border-border shadow-xs"
              }`}
            >
              {/* Date Navigation Header inside Left Panel */}
              <div className="flex items-center justify-between pb-3 border-b border-border shrink-0 gap-2">
                <div className="text-sm font-bold text-foreground whitespace-nowrap">
                  {getLeftHeaderTitle()}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <button
                    onClick={handlePrevDate}
                    className={`p-1.5 transition-colors cursor-pointer ${
                      isPixelTheme
                        ? "rounded-xs border border-border hover:bg-muted text-foreground"
                        : "rounded-lg hover:bg-accent text-foreground"
                    }`}
                    title="上一阶段"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleGoToday}
                    className={`px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      isPixelTheme
                        ? "rounded-xs border border-primary/30 bg-primary/10 text-primary shadow-[1px_1px_0px_#000]"
                        : "rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                    }`}
                  >
                    今天
                  </button>
                  <button
                    onClick={handleNextDate}
                    className={`p-1.5 transition-colors cursor-pointer ${
                      isPixelTheme
                        ? "rounded-xs border border-border hover:bg-muted text-foreground"
                        : "rounded-lg hover:bg-accent text-foreground"
                    }`}
                    title="下一阶段"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* View Content */}
              <div className="flex-1 min-h-0 pt-3 overflow-hidden">
                {activeView === "day" && (
                  <DayView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onToggleComplete={handleToggleComplete}
                    onSelectTask={(t, anchorEl) =>
                      handleOpenTaskEditor(t, t.quadrant, anchorEl)
                    }
                    onCreateTask={(quadrant, initialDate) =>
                      handleOpenTaskEditor(undefined, quadrant || "Q2", undefined, initialDate)
                    }
                  />
                )}
                {activeView === "week" && (
                  <WeekView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onSelectDate={(d) => setCurrentDate(d)}
                    onSelectTask={(t, anchorEl) =>
                      handleOpenTaskEditor(t, t.quadrant, anchorEl)
                    }
                    onCreateTask={(quadrant, initialDate) =>
                      handleOpenTaskEditor(undefined, quadrant || "Q2", undefined, initialDate)
                    }
                  />
                )}
                {activeView === "month" && (
                  <MonthView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onSelectDay={(d) => {
                      setCurrentDate(d);
                      setActiveView("day");
                    }}
                    onSelectTask={(t, anchorEl) =>
                      handleOpenTaskEditor(t, t.quadrant, anchorEl)
                    }
                    onCreateTask={(quadrant, initialDate) =>
                      handleOpenTaskEditor(undefined, quadrant || "Q2", undefined, initialDate)
                    }
                  />
                )}
              </div>
            </div>

            {/* Right Panel: Period Task Overview Sidebar (Reference: workbuddy) */}
            <aside
              className={`w-80 shrink-0 p-4 flex flex-col min-h-0 h-full overflow-hidden ${
                isPixelTheme
                  ? "bg-card rounded-xl border-2 border-border shadow-[3px_3px_0px_rgba(0,0,0,0.1)] font-mono"
                  : "bg-card rounded-2xl border border-border shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
                <h3 className="text-xs font-bold text-foreground">
                  {getSidebarTitle()}
                </h3>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 font-semibold ${
                    isPixelTheme
                      ? "rounded-xs border border-primary/30 bg-primary/10 text-primary shadow-[1px_1px_0px_#000]"
                      : "rounded-full bg-primary/10 text-primary"
                  }`}
                >
                  {periodTasks.length} 项
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-3 pr-1">
                {periodTasks.length === 0 ? (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-xs text-muted-foreground gap-2.5">
                    <p>
                      {activeView === "day"
                        ? "当日暂无任务"
                        : activeView === "week"
                        ? "本周暂无任务"
                        : "本月暂无任务"}
                    </p>
                    <button
                      onClick={() =>
                        handleOpenTaskEditor(undefined, "Q2", undefined, currentDateStr)
                      }
                      className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        isPixelTheme
                          ? "rounded-xs border border-primary/30 bg-primary/10 text-primary shadow-[1px_1px_0px_#000] hover:bg-primary/20"
                          : "rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                      }`}
                    >
                      <Plus size={13} />
                      <span>添加任务</span>
                    </button>
                  </div>
                ) : (
                  periodTasks.map((t) => {
                    return (
                      <div
                        key={t.id}
                        onClick={(e) => handleOpenTaskEditor(t, t.quadrant, e.currentTarget)}
                        className={`p-2.5 transition-all space-y-1.5 relative cursor-pointer ${
                          isPixelTheme
                            ? "rounded-xs border border-border bg-card shadow-[1px_1px_0px_rgba(0,0,0,0.06)]"
                            : "rounded-xl border border-border shadow-2xs"
                        } ${
                          t.completed
                            ? "bg-muted/40 opacity-60"
                            : isPixelTheme
                            ? "hover:bg-amber-100/50 dark:hover:bg-amber-950/40"
                            : "hover:border-primary/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleComplete(t.id);
                              }}
                              className={`mt-0.5 transition-colors shrink-0 cursor-pointer ${
                                isPixelTheme
                                  ? `size-4 rounded-xs flex items-center justify-center ${
                                      t.completed
                                        ? "bg-emerald-600 text-white border border-emerald-800 shadow-[1px_1px_0px_#064e3b]"
                                        : "border-2 border-amber-900/60 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:border-emerald-500 shadow-[1px_1px_0px_#000]"
                                    }`
                                  : "text-muted-foreground hover:text-primary"
                              }`}
                            >
                              {isPixelTheme ? (
                                t.completed && <Check size={11} className="stroke-[3]" />
                              ) : t.completed ? (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>
                            <div className="min-w-0">
                              <div
                                className={`text-xs font-bold leading-snug break-words ${
                                  t.completed
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground"
                                } ${isPixelTheme ? "font-mono" : ""}`}
                              >
                                {t.title}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-medium shrink-0 border ${
                              isPixelTheme ? "rounded-xs font-mono shadow-[1px_1px_0px_#000]" : "rounded"
                            } ${
                              t.quadrant === "Q1"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                : t.quadrant === "Q2"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : t.quadrant === "Q3"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {t.quadrant}
                          </span>
                        </div>

                        {getTaskDescriptionText(t.description) && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 pl-6">
                            {getTaskDescriptionText(t.description)}
                          </p>
                        )}

                        <div className="flex items-center justify-between pl-6 pt-0.5 text-[10px] text-muted-foreground">
                          {getTaskEndAt(t) && (
                            <span className="flex items-center gap-1 font-mono">
                              <Clock size={11} className="text-primary" />
                              {new Date(getTaskEndAt(t)!).toLocaleDateString("zh-CN", {
                                month: "numeric",
                                day: "numeric",
                              })} {taskTimeLabel(t)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};
