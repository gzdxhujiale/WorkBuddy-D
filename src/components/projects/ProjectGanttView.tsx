import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateYMD, parseYMD, todayYMD } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { openQuickEditWindow } from "@/services/quickEditWindow";
import { createTaskId } from "@/lib/entityIds";
import type { Project, ProjectStage, ProjectTask } from "@/types/projects";

export type GanttViewScale = "week" | "biweekly" | "month";

interface ProjectGanttViewProps {
  project: Project;
  stages: ProjectStage[];
  tasks: ProjectTask[];
  disabled?: boolean;
  onSaveStage?: (stage: ProjectStage) => void;
  onSaveTask: (task: ProjectTask) => void;
  onDeleteTask?: (taskId: string) => void;
}

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

function getLocalDayMidnight(dateOrTimestampOrStr?: Date | number | string | null): Date | null {
  if (!dateOrTimestampOrStr) return null;
  if (typeof dateOrTimestampOrStr === "string") {
    return parseYMD(dateOrTimestampOrStr.slice(0, 10));
  }
  const d = typeof dateOrTimestampOrStr === "number" ? new Date(dateOrTimestampOrStr) : dateOrTimestampOrStr;
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function formatRangeLabel(scale: GanttViewScale, startDate: Date, endDate: Date): string {
  const sYear = startDate.getFullYear();
  const sMonth = startDate.getMonth() + 1;
  const sDay = startDate.getDate();
  const eYear = endDate.getFullYear();
  const eMonth = endDate.getMonth() + 1;
  const eDay = endDate.getDate();

  if (scale === "month") {
    return `${sYear}年${sMonth}月`;
  }
  if (scale === "week") {
    if (sMonth === eMonth) {
      return `${sYear}年${sMonth}月${sDay}日 - ${eDay}日`;
    }
    return `${sYear}年${sMonth}月${sDay}日 - ${eYear === sYear ? "" : `${eYear}年`}${eMonth}月${eDay}日`;
  }
  // biweekly
  if (sMonth === eMonth) {
    return `${sYear}年${sMonth}月${sDay}日 - ${eDay}日`;
  }
  return `${sYear}年${sMonth}月${sDay}日 - ${eYear === sYear ? "" : `${eYear}年`}${eMonth}月${eDay}日`;
}

export function ProjectGanttView({
  project,
  stages,
  tasks,
  disabled,
  onSaveTask,
}: ProjectGanttViewProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const todayStr = useMemo(() => todayYMD(), []);

  const [scale, setScale] = useState<GanttViewScale>("biweekly");
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  // Anchor date for timeline navigation
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getMonday(today);
  });

  // Calculate timeline date range
  const { startDate, endDate, timelineDays } = useMemo(() => {
    let start: Date;
    let end: Date;
    let count: number;

    if (scale === "week") {
      start = getMonday(anchorDate);
      count = 7;
      end = addDays(start, count - 1);
    } else if (scale === "biweekly") {
      start = getMonday(anchorDate);
      count = 14;
      end = addDays(start, count - 1);
    } else {
      // month
      start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      const daysInMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
      count = daysInMonth;
      end = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), daysInMonth);
    }

    const days: Array<{ date: Date; dateStr: string; isToday: boolean; isWeekend: boolean; dayNum: number; weekdayName: string }> = [];
    for (let i = 0; i < count; i++) {
      const d = addDays(start, i);
      const dateStr = formatDateYMD(d);
      const dayOfWeek = d.getDay();
      days.push({
        date: d,
        dateStr,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        dayNum: d.getDate(),
        weekdayName: WEEKDAY_NAMES[dayOfWeek],
      });
    }

    return {
      startDate: start,
      endDate: end,
      timelineDays: days,
    };
  }, [anchorDate, scale, todayStr]);

  // Navigate dates
  const handlePrev = () => {
    if (scale === "week") {
      setAnchorDate((d) => addDays(d, -7));
    } else if (scale === "biweekly") {
      setAnchorDate((d) => addDays(d, -14));
    } else {
      setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (scale === "week") {
      setAnchorDate((d) => addDays(d, 7));
    } else if (scale === "biweekly") {
      setAnchorDate((d) => addDays(d, 14));
    } else {
      setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  };

  const handleGoToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setAnchorDate(getMonday(today));
  };

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  // Helper: calculate bar placement (left % and width %) on the grid using normalized local calendar days
  const calculateBarSpan = (
    rawStart?: Date | number | string | null,
    rawEnd?: Date | number | string | null
  ) => {
    const startDay = getLocalDayMidnight(rawStart) || getLocalDayMidnight(rawEnd);
    const endDay = getLocalDayMidnight(rawEnd) || getLocalDayMidnight(rawStart);

    if (!startDay || !endDay) return null;

    const effectiveStart = startDay.getTime() <= endDay.getTime() ? startDay : endDay;
    const effectiveEnd = startDay.getTime() <= endDay.getTime() ? endDay : startDay;

    const wStart = startDate.getTime(); // Local midnight of first visible day
    const dayMs = 86400000;
    const totalDays = timelineDays.length;

    // Use Math.round to avoid tiny fractional floating point offsets from daylight savings or time shifts
    const startOffsetDays = Math.round((effectiveStart.getTime() - wStart) / dayMs);
    const endOffsetDays = Math.round((effectiveEnd.getTime() - wStart) / dayMs) + 1; // +1 to encompass the full end day

    const clampedStart = Math.max(0, startOffsetDays);
    const clampedEnd = Math.min(totalDays, endOffsetDays);

    if (clampedEnd <= 0 || clampedStart >= totalDays || clampedEnd <= clampedStart) {
      // Out of visible timeline window
      return null;
    }

    const left = (clampedStart / totalDays) * 100;
    const width = Math.max(0.5, ((clampedEnd - clampedStart) / totalDays) * 100);

    return { left, width };
  };

  // Create task helper
  const handleCreateTaskAtDate = (stageId: string, dateStr: string, el: HTMLElement) => {
    if (disabled) return;
    const stage = stages.find((s) => s.id === stageId);
    const d = parseYMD(dateStr);
    if (d) d.setHours(23, 59, 59, 999);
    const targetTimestamp = d ? d.getTime() : Date.now();

    void openQuickEditWindow({
      anchorEl: el,
      quadrant: "Q2",
      onCreate: (_quadrant, draftData) => {
        void onSaveTask({
          id: createTaskId(),
          title: draftData.title,
          description: draftData.description,
          quadrant: draftData.quadrant || "Q2",
          priority: draftData.priority || "medium",
          completed: false,
          projectId: project.id,
          projectStageId: stageId,
          scheduleMode: draftData.scheduleMode || "point",
          scheduledStartAt: draftData.scheduledStartAt ?? targetTimestamp,
          scheduledEndAt: draftData.scheduledEndAt ?? targetTimestamp,
          reminder: draftData.reminder,
          assigneeName: stage?.defaultAssigneeName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      },
      onClosed: () => {},
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-card overflow-hidden transition-all",
        isPixelTheme
          ? "rounded-xs border-2 border-border/90 shadow-[3px_3px_0px_rgba(0,0,0,0.08)] font-mono"
          : "rounded-xl border border-border shadow-2xs"
      )}
    >
      {/* Top Controls Bar */}
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 p-3.5 border-b select-none",
          isPixelTheme ? "border-b-2 border-border/90 bg-amber-50/30 dark:bg-amber-950/30 font-mono" : "border-border bg-muted/20"
        )}
      >
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handlePrev}
            className={cn("size-7.5 cursor-pointer", isPixelTheme && "rounded-xs border-2 shadow-[1px_1px_0px_#000]")}
            title="上一周期"
          >
            <ChevronLeft size={16} />
          </Button>

          <span
            className={cn(
              "text-xs font-bold text-foreground min-w-[140px] text-center",
              isPixelTheme && "font-mono"
            )}
          >
            {formatRangeLabel(scale, startDate, endDate)}
          </span>

          <Button
            size="icon"
            variant="outline"
            onClick={handleNext}
            className={cn("size-7.5 cursor-pointer", isPixelTheme && "rounded-xs border-2 shadow-[1px_1px_0px_#000]")}
            title="下一周期"
          >
            <ChevronRight size={16} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleGoToday}
            className={cn(
              "h-7.5 px-2 text-xs font-medium cursor-pointer",
              isPixelTheme && "rounded-xs border border-border bg-muted shadow-[1px_1px_0px_#000]"
            )}
          >
            今天
          </Button>
        </div>

        {/* View Scale Switcher */}
        <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border/60">
          {(["week", "biweekly", "month"] as GanttViewScale[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setScale(mode)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                scale === mode
                  ? isPixelTheme
                    ? "rounded-xs bg-amber-500 text-amber-950 font-bold border border-amber-900 shadow-[1px_1px_0px_#000]"
                    : "rounded-md bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "week" ? "周视图" : mode === "biweekly" ? "双周视图" : "月视图"}
            </button>
          ))}
        </div>
      </header>

      {/* Main Gantt Body */}
      <div className="flex min-h-[380px] max-h-[600px] overflow-hidden">
        {/* Left Column: Stage & Task Tree */}
        <div
          className={cn(
            "w-72 shrink-0 border-r flex flex-col overflow-y-auto select-none bg-card",
            isPixelTheme ? "border-r-2 border-border/90 font-mono" : "border-border"
          )}
        >
          {/* Header */}
          <div
            className={cn(
              "h-10 px-3 border-b flex items-center justify-between text-xs font-bold text-muted-foreground shrink-0",
              isPixelTheme ? "border-b-2 border-border/90 bg-amber-100/40 dark:bg-amber-950/40 font-mono" : "border-border bg-muted/40"
            )}
          >
            <span>阶段与任务项</span>
            <span>状态/负责人</span>
          </div>

          {/* Tree Rows */}
          <div className="divide-y divide-border/60">
            {stages.map((stage, sIdx) => {
              const stageTasks = tasks.filter((t) => t.projectStageId === stage.id);
              const completedCount = stageTasks.filter((t) => t.completed).length;
              const isCollapsed = collapsedStages[stage.id];
              const isStageAllDone = stageTasks.length > 0 && completedCount === stageTasks.length;

              return (
                <div key={stage.id} className="flex flex-col">
                  {/* Stage Row Header */}
                  <div
                    onClick={() => toggleStageCollapse(stage.id)}
                    className={cn(
                      "h-10 px-2.5 flex items-center justify-between cursor-pointer transition-colors group",
                      isPixelTheme
                        ? isStageAllDone
                          ? "bg-emerald-100/60 dark:bg-emerald-950/40 hover:bg-emerald-200/60"
                          : "bg-muted/40 hover:bg-muted/70"
                        : isStageAllDone
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "bg-muted/30 hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStageCollapse(stage.id);
                        }}
                        className="p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <span
                        className={cn(
                          "size-4.5 flex items-center justify-center text-[10px] font-black shrink-0",
                          isStageAllDone
                            ? "rounded-xs bg-emerald-600 text-white"
                            : isPixelTheme
                            ? "rounded-xs bg-amber-500 text-amber-950"
                            : "rounded-full bg-primary text-primary-foreground"
                        )}
                      >
                        {isStageAllDone ? "✓" : sIdx + 1}
                      </span>

                      <span className={cn("text-xs font-bold truncate text-foreground", isPixelTheme && "font-mono")}>
                        {stage.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
                      <span className={cn(isStageAllDone && "text-emerald-700 dark:text-emerald-300 font-bold")}>
                        {completedCount}/{stageTasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Tasks under Stage */}
                  {!isCollapsed && (
                    <div className="divide-y divide-border/30">
                      {stageTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            void openQuickEditWindow({
                              task,
                              anchorEl: e.currentTarget,
                              onCommit: (taskId, updates) => {
                                void onSaveTask({ ...task, ...updates, id: taskId });
                              },
                              onClosed: () => {},
                            });
                          }}
                          className={cn(
                            "h-9 pl-7 pr-3 flex items-center justify-between cursor-pointer transition-colors group",
                            task.completed
                              ? "opacity-60 bg-card hover:opacity-100 hover:bg-accent/40"
                              : "hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSaveTask({
                                  ...task,
                                  completed: !task.completed,
                                  completedAt: !task.completed ? Date.now() : undefined,
                                });
                              }}
                              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                            >
                              {task.completed ? (
                                <CheckCircle2 size={14} className="text-emerald-600 fill-emerald-600/20" />
                              ) : (
                                <Circle size={14} />
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
                            <span className="text-[10px] text-muted-foreground/80 bg-muted px-1.5 py-0.2 rounded shrink-0 ml-1">
                              {task.assigneeName}
                            </span>
                          )}
                        </div>
                      ))}

                      {stageTasks.length === 0 && (
                        <div
                          onClick={(e) => handleCreateTaskAtDate(stage.id, todayStr, e.currentTarget)}
                          className="h-8 pl-8 pr-3 flex items-center text-[11px] text-muted-foreground/60 italic hover:text-primary cursor-pointer"
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
        </div>

        {/* Right Column: Timeline Grid & Schedule Bars */}
        <div className="flex-1 flex flex-col overflow-x-auto min-w-0">
          {/* Header Row: Days */}
          <div
            className={cn(
              "h-10 border-b flex shrink-0 select-none",
              isPixelTheme ? "border-b-2 border-border/90 bg-amber-100/40 dark:bg-amber-950/40 font-mono" : "border-border bg-muted/40"
            )}
          >
            {timelineDays.map((day) => (
              <div
                key={day.dateStr}
                className={cn(
                  "flex-1 min-w-[36px] flex flex-col items-center justify-center border-r border-border/50 text-[10px]",
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

          {/* Grid Content Rows */}
          <div className="flex-1 divide-y divide-border/60 overflow-y-auto relative">
            {stages.map((stage) => {
              const stageTasks = tasks.filter((t) => t.projectStageId === stage.id);
              const isCollapsed = collapsedStages[stage.id];
              const isStageAllDone = stageTasks.length > 0 && stageTasks.every((t) => t.completed);

              // Calculate stage bar span
              const taskTimes = stageTasks
                .map((t) => t.scheduledStartAt || t.scheduledEndAt)
                .filter(Boolean) as number[];

              const stageStartVal = stage.startDate || (taskTimes.length ? Math.min(...taskTimes) : null);
              const stageEndVal = stage.endDate || (taskTimes.length ? Math.max(...taskTimes) : null);
              const stageSpan = calculateBarSpan(stageStartVal, stageEndVal);

              const completedTasksCount = stageTasks.filter((t) => t.completed).length;
              const stageProgress = stageTasks.length > 0 ? Math.round((completedTasksCount / stageTasks.length) * 100) : 0;

              return (
                <div key={`track-${stage.id}`} className="flex flex-col">
                  {/* Stage Track Row */}
                  <div
                    className={cn(
                      "h-10 relative flex items-center",
                      isPixelTheme
                        ? isStageAllDone
                          ? "bg-emerald-100/30 dark:bg-emerald-950/20"
                          : "bg-muted/20"
                        : isStageAllDone
                        ? "bg-emerald-500/5"
                        : "bg-muted/10"
                    )}
                  >
                    {/* Vertical Grid Lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {timelineDays.map((day) => (
                        <div
                          key={day.dateStr}
                          className={cn(
                            "flex-1 min-w-[36px] border-r border-border/30 h-full",
                            day.isToday && "bg-amber-400/10 dark:bg-amber-600/10",
                            day.isWeekend && "bg-muted/20"
                          )}
                        />
                      ))}
                    </div>

                    {/* Stage Bar */}
                    {stageSpan && (
                      <div
                        style={{
                          left: `${stageSpan.left}%`,
                          width: `${stageSpan.width}%`,
                        }}
                        className={cn(
                          "absolute h-6 z-10 flex items-center px-2 text-[11px] font-bold overflow-hidden transition-all shadow-sm",
                          isStageAllDone
                            ? isPixelTheme
                              ? "bg-emerald-600 text-white rounded-xs border-2 border-emerald-800 shadow-[1px_1px_0px_#064e3b]"
                              : "bg-emerald-600 text-white rounded-md"
                            : isPixelTheme
                            ? "bg-amber-500/90 text-amber-950 rounded-xs border-2 border-amber-900 shadow-[1px_1px_0px_#000]"
                            : "bg-primary/80 text-primary-foreground rounded-md"
                        )}
                        title={`${stage.name}: (${stageProgress}% 完成)`}
                      >
                        <div
                          className="absolute inset-0 bg-white/20 dark:bg-white/10 pointer-events-none"
                          style={{ width: `${stageProgress}%` }}
                        />
                        <span className="truncate relative z-10 flex items-center gap-1 font-mono">
                          {isStageAllDone && "🏆 "}
                          {stage.name} ({stageProgress}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tasks Track Rows */}
                  {!isCollapsed && (
                    <div className="divide-y divide-border/30">
                      {stageTasks.map((task) => {
                        const taskSpan = calculateBarSpan(
                          task.scheduledStartAt || task.scheduledEndAt,
                          task.scheduledEndAt || task.scheduledStartAt
                        );

                        return (
                          <div
                            key={`task-track-${task.id}`}
                            className="h-9 relative flex items-center group/track"
                          >
                            {/* Vertical Grid Lines & Click to Add */}
                            <div className="absolute inset-0 flex">
                              {timelineDays.map((day) => (
                                <div
                                  key={day.dateStr}
                                  onClick={() => {
                                    if (disabled) return;
                                    const d = parseYMD(day.dateStr);
                                    if (!d) return;
                                    d.setHours(23, 59, 59, 999);
                                    onSaveTask({
                                      ...task,
                                      scheduledStartAt: d.getTime(),
                                      scheduledEndAt: d.getTime(),
                                      scheduleMode: "point",
                                    });
                                  }}
                                  className={cn(
                                    "flex-1 min-w-[36px] border-r border-border/20 h-full cursor-pointer hover:bg-primary/10 transition-colors",
                                    day.isToday && "bg-amber-400/10 dark:bg-amber-600/10",
                                    day.isWeekend && "bg-muted/10"
                                  )}
                                  title={`点击设置该任务日期为 ${day.dateStr}`}
                                />
                              ))}
                            </div>

                            {/* Task Bar */}
                            {taskSpan && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openQuickEditWindow({
                                    task,
                                    anchorEl: e.currentTarget,
                                    onCommit: (taskId, updates) => {
                                      void onSaveTask({ ...task, ...updates, id: taskId });
                                    },
                                    onClosed: () => {},
                                  });
                                }}
                                style={{
                                  left: `${taskSpan.left}%`,
                                  width: `${taskSpan.width}%`,
                                }}
                                className={cn(
                                  "absolute h-5 z-20 flex items-center px-2 text-[10px] font-medium overflow-hidden cursor-pointer transition-all hover:scale-[1.02] shadow-2xs",
                                  task.completed
                                    ? isPixelTheme
                                      ? "bg-emerald-200/90 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 rounded-xs border border-emerald-700"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded"
                                    : isPixelTheme
                                    ? "bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 rounded-xs border-2 border-amber-900/60 shadow-[1px_1px_0px_#000]"
                                    : "bg-card border border-border hover:border-primary text-foreground rounded shadow-2xs"
                                )}
                                title={`${task.title}`}
                              >
                                <span className={cn("truncate", task.completed && "line-through opacity-70")}>
                                  {task.title}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {stageTasks.length === 0 && (
                        <div className="h-8 relative flex items-center">
                          <div className="absolute inset-0 flex pointer-events-none">
                            {timelineDays.map((day) => (
                              <div key={day.dateStr} className="flex-1 min-w-[36px] border-r border-border/20 h-full" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
