import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ListTodo,
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
  Tag,
  Timer,
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

export type ViewType = "quadrant" | "day" | "week" | "month";
export type StatusFilterType = "uncompleted" | "all" | "completed";

export const TimeManagementPanel: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("quadrant");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  
  // Filters matching workbuddy requirements:
  // statusFilter: Default 'uncompleted' (未完成)
  // quadrantFilter: 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' (Priority Q1~Q4, hidden in quadrant view)
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("uncompleted");
  const [quadrantFilter, setQuadrantFilter] = useState<string>("ALL");

  const { data: tmData } = useTimeManagementData();
  const roles = tmData?.roles ?? [];
  const tasks = tmData?.tasks ?? [];

  const { addTask, updateTask, deleteTask } = useTaskActions();

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // The editor window is created only when a user opens it. Prewarming it on
  // startup creates a second independent webview and duplicates data loading.
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
      onSave: (taskId, updates) => {
        updateTask(taskId, updates);
      },
      onCreate: (targetQ, draft) => {
        const newTask = addTask(
          draft.title,
          targetQ,
          draft.roleId
        );
        const fallbackEndAt = initialDate
          ? new Date(`${initialDate}T23:59:59.999`).getTime()
          : undefined;
        if (
          draft.description ||
          draft.scheduleMode ||
          draft.scheduledStartAt ||
          draft.scheduledEndAt ||
          fallbackEndAt ||
          draft.reminder
        ) {
          updateTask(newTask.id, {
            description: draft.description,
            scheduleMode: draft.scheduleMode ?? (fallbackEndAt ? "point" : undefined),
            scheduledStartAt: draft.scheduledStartAt,
            scheduledEndAt: draft.scheduledEndAt ?? fallbackEndAt,
            reminder: draft.reminder,
          });
        }
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

  // Filter tasks based on statusFilter and quadrantFilter
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Status Filter (Default: 未完成)
      if (statusFilter === "uncompleted" && t.completed) return false;
      if (statusFilter === "completed" && !t.completed) return false;

      // 2. Priority Filter (Q1~Q4)
      if (quadrantFilter !== "ALL" && t.quadrant !== quadrantFilter) {
        return false;
      }

      return true;
    });
  }, [tasks, statusFilter, quadrantFilter]);

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
          <span className="text-slate-400 dark:text-slate-500 font-medium ml-2 text-xs">
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
          <span className="text-slate-400 dark:text-slate-500 font-medium ml-2 text-xs">
            · 周度任务视图
          </span>
        </>
      );
    }
    return (
      <>
        {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月{currentDate.getDate()}日
        <span className="text-slate-400 dark:text-slate-500 font-medium ml-2 text-xs">
          · 日任务时间轴
        </span>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden select-none">
      {/* Panel Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ListTodo className="text-blue-600 dark:text-blue-400" size={20} />
            {activeView === "quadrant" && "任务中心"}
            {activeView === "day" && "时间管理 · 日视图"}
            {activeView === "week" && "时间管理 · 周视图"}
            {activeView === "month" && "时间管理 · 月视图"}
          </h1>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          <button onClick={() => void toggleFocusAssistant()} className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300" title="显示或隐藏悬浮专注助手"><Timer size={14} />悬浮专注</button>
          {/* View Switcher Tabs (筛选组件左侧 Tabs) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setActiveView("quadrant")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeView === "quadrant"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid size={14} />
              <span>四象限</span>
            </button>
            <button
              onClick={() => setActiveView("day")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeView === "day"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Sun size={14} />
              <span>日视图</span>
            </button>
            <button
              onClick={() => setActiveView("week")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeView === "week"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <CalendarRange size={14} />
              <span>周视图</span>
            </button>
            <button
              onClick={() => setActiveView("month")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeView === "month"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <CalendarIcon size={14} />
              <span>月视图</span>
            </button>
          </div>

          {/* Status Filter Selector (状态筛选: 默认未完成) */}
          <div className="flex items-center text-xs text-slate-500 font-medium">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilterType)}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
            >
              <option value="uncompleted">状态: 未完成</option>
              <option value="all">状态: 全部</option>
              <option value="completed">状态: 已完成</option>
            </select>
          </div>

          {/* Priority / Quadrant Filter Selector (Q1~Q4) */}
          <div className="flex items-center text-xs text-slate-500 font-medium">
            <select
              value={quadrantFilter}
              onChange={(e) => setQuadrantFilter(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">优先级: 全部</option>
              <option value="Q1">Q1 (重要且紧急)</option>
              <option value="Q2">Q2 (重要不紧急)</option>
              <option value="Q3">Q3 (紧急不重要)</option>
              <option value="Q4">Q4 (不重要不紧急)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-hidden flex flex-col">
        {activeView === "quadrant" ? (
          <DailyQuadrants
            tasks={filteredTasks}
            roles={roles}
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
            <div className="min-w-0 flex-1 bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-xs flex flex-col min-h-0 h-full overflow-hidden">
              {/* Date Navigation Header inside Left Panel (Reference: workbuddy) */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800 shrink-0 gap-2">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {getLeftHeaderTitle()}
                </div>
                <div className="flex items-center gap-1 text-slate-500 shrink-0">
                  <button
                    onClick={handlePrevDate}
                    className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    title="上一阶段"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleGoToday}
                    className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-800 hover:bg-blue-200/60 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                  >
                    今天
                  </button>
                  <button
                    onClick={handleNextDate}
                    className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
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
                    roles={roles}
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
                    roles={roles}
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
                    roles={roles}
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
            <aside className="w-80 shrink-0 bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-xs flex flex-col min-h-0 h-full overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {getSidebarTitle()}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold">
                  {periodTasks.length} 项
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-3 pr-1">
                {periodTasks.length === 0 ? (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-xs text-slate-400 dark:text-slate-500 gap-2.5">
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
                      className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-medium border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={13} />
                      <span>添加任务</span>
                    </button>
                  </div>
                ) : (
                  periodTasks.map((t) => {
                    const role = roles.find((r) => r.id === t.roleId);
                    return (
                      <div
                        key={t.id}
                        onClick={(e) => handleOpenTaskEditor(t, t.quadrant, e.currentTarget)}
                        className={`p-2.5 rounded-xl border transition-all space-y-1.5 relative cursor-pointer ${
                          t.completed
                            ? "bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60"
                            : "bg-white/80 dark:bg-slate-850 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400/60 shadow-2xs"
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
                              className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
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
                                    ? "line-through text-slate-400 dark:text-slate-500"
                                    : "text-slate-800 dark:text-slate-100"
                                }`}
                              >
                                {t.title}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 border ${
                              t.quadrant === "Q1"
                                ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                                : t.quadrant === "Q2"
                                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                : t.quadrant === "Q3"
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {t.quadrant}
                          </span>
                        </div>

                        {t.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 pl-6">
                            {t.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pl-6 pt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          {getTaskEndAt(t) && (
                            <span className="flex items-center gap-1 font-mono">
                              <Clock size={11} className="text-blue-500" />
                              {new Date(getTaskEndAt(t)!).toLocaleDateString("zh-CN", {
                                month: "numeric",
                                day: "numeric",
                              })} {taskTimeLabel(t)}
                            </span>
                          )}

                          {role && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white shadow-2xs ml-auto"
                              style={{ backgroundColor: role.color || "#3b82f6" }}
                            >
                              <Tag size={10} />
                              {role.name}
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
