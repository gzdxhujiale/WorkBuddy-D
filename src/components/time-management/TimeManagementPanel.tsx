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

export type ViewType = "quadrant" | "day" | "week" | "month";
export type StatusFilterType = "uncompleted" | "all" | "completed";
type ProjectTaskFilter = "non-project" | "all" | "project";

export const TimeManagementPanel: React.FC = () => {
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

  const handlePrevDate = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (activeView === "day") {
        d.setDate(d.getDate() - 1);
      } else if (activeView === "week") {
        d.setDate(d.getDate() - 7);
      } else if (activeView === "month") {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNextDate = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (activeView === "day") {
        d.setDate(d.getDate() + 1);
      } else if (activeView === "week") {
        d.setDate(d.getDate() + 7);
      } else if (activeView === "month") {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (projectTaskFilter === "non-project" && t.projectId) return false;
      if (projectTaskFilter === "project" && !t.projectId) return false;

      if (statusFilter === "uncompleted" && t.completed) return false;
      if (statusFilter === "completed" && !t.completed) return false;

      if (quadrantFilter !== "ALL" && t.quadrant !== quadrantFilter) {
        return false;
      }

      return true;
    });
  }, [tasks, projectTaskFilter, statusFilter, quadrantFilter]);

  const formatDateYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const currentDateStr = formatDateYMD(currentDate);

  const getWeekRange = (d: Date) => {
    const dayOfWeek = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(d.getDate() - dayOfWeek);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  // Filter tasks based on activeView for right side panel & sub-views
  // Day View = 当日任务, Week View = 当周任务, Month View = 当月任务
  const periodTasks = useMemo(() => {
    const list = filteredTasks.filter((t) => {
      if (activeView === "day") {
        return taskIntersectsDay(t, currentDate);
      }

      if (activeView === "week") {
        const { monday, sunday } = getWeekRange(currentDate);
        return taskIntersectsInterval(t, monday.getTime(), sunday.getTime() + 1);
      }

      if (activeView === "month") {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).getTime();
        return taskIntersectsInterval(t, monthStart, monthEnd);
      }

      return true;
    });

    if (activeView === "day") {
      return sortTasksByQuadrantAndDeadline(list);
    }
    return list;
  }, [filteredTasks, activeView, currentDate]);

  const getSidebarTitle = () => {
    if (activeView === "day") {
      return `${currentDate.getMonth() + 1}月${currentDate.getDate()}日 · 当日任务列表`;
    }
    if (activeView === "week") {
      const { monday, sunday } = getWeekRange(currentDate);
      return `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日 · 当周任务列表`;
    }
    if (activeView === "month") {
      return `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月 · 当月任务列表`;
    }
    return "任务列表";
  };

  const getLeftHeaderTitle = () => {
    const monthLabel = `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月`;
    if (activeView === "month") {
      return (
        <>
          {monthLabel}
          <span className="text-muted-foreground font-medium ml-2 text-xs">
            · 月度任务截止表
          </span>
        </>
      );
    }
    if (activeView === "week") {
      const { monday, sunday } = getWeekRange(currentDate);
      return (
        <>
          {monday.getMonth() + 1}月{monday.getDate()}日 - {sunday.getMonth() + 1}月{sunday.getDate()}日
          <span className="text-muted-foreground font-medium ml-2 text-xs">
            · 周度任务视图
          </span>
        </>
      );
    }
    return (
      <>
        {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月{currentDate.getDate()}日
        <span className="text-muted-foreground font-medium ml-2 text-xs">
          · 日任务时间轴
        </span>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden select-none">
      {/* Panel Header */}
      <header className="flex h-12 items-center justify-between gap-3 border-b border-border bg-card px-6 shrink-0 select-none">
        {/* View Switcher Tabs */}
        <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
          <button
            onClick={() => setActiveView("quadrant")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeView === "quadrant"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={14} />
            <span>四象限</span>
          </button>
          <button
            onClick={() => setActiveView("day")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeView === "day"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sun size={14} />
            <span>日视图</span>
          </button>
          <button
            onClick={() => setActiveView("week")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeView === "week"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarRange size={14} />
            <span>周视图</span>
          </button>
          <button
            onClick={() => setActiveView("month")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeView === "month"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarIcon size={14} />
            <span>月视图</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => void toggleFocusAssistant()} className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 cursor-pointer" title="显示或隐藏悬浮专注助手"><Timer size={14} />悬浮专注</button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              aria-label="筛选任务"
            >
              <SlidersHorizontal size={14} />
              筛选
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 gap-3 p-3" aria-label="任务筛选选项">
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                任务范围
                <select
                  value={projectTaskFilter}
                  onChange={(event) => setProjectTaskFilter(event.target.value as ProjectTaskFilter)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs font-normal outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="non-project">仅非项目任务</option>
                  <option value="all">全部任务</option>
                  <option value="project">仅项目任务</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                状态
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilterType)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs font-normal outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="uncompleted">未完成</option>
                  <option value="all">全部</option>
                  <option value="completed">已完成</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                优先级
                <select
                  value={quadrantFilter}
                  onChange={(event) => setQuadrantFilter(event.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs font-normal outline-none focus:ring-1 focus:ring-ring"
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
            <div className="min-w-0 flex-1 bg-card rounded-2xl p-4 border border-border shadow-xs flex flex-col min-h-0 h-full overflow-hidden">
              {/* Date Navigation Header inside Left Panel */}
              <div className="flex items-center justify-between pb-3 border-b border-border shrink-0 gap-2">
                <div className="text-sm font-bold text-foreground whitespace-nowrap">
                  {getLeftHeaderTitle()}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <button
                    onClick={handlePrevDate}
                    className="p-1.5 rounded-lg hover:bg-accent text-foreground transition-colors cursor-pointer"
                    title="上一阶段"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleGoToday}
                    className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    今天
                  </button>
                  <button
                    onClick={handleNextDate}
                    className="p-1.5 rounded-lg hover:bg-accent text-foreground transition-colors cursor-pointer"
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
            <aside className="w-80 shrink-0 bg-card rounded-2xl p-4 border border-border shadow-xs flex flex-col min-h-0 h-full overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
                <h3 className="text-xs font-bold text-foreground">
                  {getSidebarTitle()}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
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
                      className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer flex items-center gap-1"
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
                        className={`p-2.5 rounded-xl border transition-all space-y-1.5 relative cursor-pointer ${
                          t.completed
                            ? "bg-muted/40 border-border opacity-60"
                            : "bg-card border-border hover:border-primary/60 shadow-2xs"
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
                              className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0 cursor-pointer"
                            >
                              {t.completed ? (
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
                                }`}
                              >
                                {t.title}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 border ${
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
