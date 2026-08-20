import React, { useState, memo } from "react";
import { Plus, CheckCircle2, Circle, AlignLeft, X, ChevronDown, ChevronRight, Check } from "lucide-react";
import { Task, QuadrantType } from "@/types/timeManagement";
import { hasTaskDescription } from "@/lib/taskDescription";
import { Button } from "@/components/ui/button";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";

const getPixelGroupTitle = (group: string): string => {
  switch (group) {
    case "已过期":
      return "💀 逾期讨伐";
    case "一天内":
      return "⏳ 24H迫近";
    case "三天内":
      return "⚔️ 三日攻坚";
    case "一周内":
      return "📜 本周排期";
    case "一周外":
      return "🗺️ 远期探索";
    case "无日期":
      return "📦 待定委托";
    default:
      return group;
  }
};

interface CollapsibleGroupProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isExpired?: boolean;
}

const CollapsibleGroup: React.FC<CollapsibleGroupProps> = memo(
  ({ title, count, children, defaultExpanded = true, isExpired = false }) => {
    const { isPixelTheme } = useAppThemeStyle();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    if (count === 0) return null;

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    };

    return (
      <div className="mb-2 select-none" onDragOver={handleDragOver}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          onDragOver={handleDragOver}
          aria-expanded={isExpanded}
          aria-label={`${title}分组`}
          className="flex items-center gap-1.5 py-1 text-xs transition-colors w-full text-left font-medium cursor-pointer"
        >
          {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
          <span
            className={
              isExpired
                ? "text-red-600 dark:text-red-400 font-semibold"
                : isPixelTheme
                  ? "text-muted-foreground hover:text-foreground font-semibold font-mono"
                  : "text-muted-foreground hover:text-foreground font-medium"
            }
          >
            {isPixelTheme ? getPixelGroupTitle(title) : title}
          </span>
          <span
            className={`px-1.5 py-0.5 text-[10px] font-semibold ${isPixelTheme ? "rounded-xs font-mono border border-border/80 shadow-[1px_1px_0px_#000]" : "rounded-full"
              } ${isExpired
                ? isPixelTheme
                  ? "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-800"
                  : "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
              }`}
          >
            {count}
          </span>
        </button>

        {isExpanded && (
          <div className="flex flex-col gap-1.5 pl-2 mt-1" onDragOver={handleDragOver}>
            {children}
          </div>
        )}
      </div>
    );
  }
);

export interface DailyQuadrantsProps {
  tasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onCreateTask: (quadrant: QuadrantType, anchorEl?: HTMLElement) => void;
  hideCompleted: boolean;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task, anchorEl?: HTMLElement) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onMoveAndReorderTask: (
    taskId: string,
    updates: Pick<Task, "quadrant" | "scheduleMode" | "scheduledStartAt" | "scheduledEndAt">,
    orderedIds: string[],
  ) => void;
}

const QUADRANT_CONFIG: Record<
  QuadrantType,
  {
    title: string;
    pixelTitle: string;
    desc: string;
    textClass: string;
    badgeBgClass: string;
    iconTextClass: string;
    accentBorder: string;
    bgGradient: string;
  }
> = {
  Q1: {
    title: "重要且紧急",
    pixelTitle: "🔥 紧急讨伐",
    desc: "危机、急迫的问题",
    textClass: "text-red-600 dark:text-red-400",
    badgeBgClass: "bg-red-500",
    iconTextClass: "text-red-500",
    accentBorder: "border-t-4 border-t-red-500",
    bgGradient: "bg-gradient-to-b from-red-500/5 via-transparent to-transparent",
  },
  Q2: {
    title: "重要不紧急",
    pixelTitle: "🌿 核心修炼",
    desc: "计划、预防、要事",
    textClass: "text-blue-600 dark:text-blue-400",
    badgeBgClass: "bg-blue-600",
    iconTextClass: "text-blue-600",
    accentBorder: "border-t-4 border-t-blue-600",
    bgGradient: "bg-gradient-to-b from-blue-500/5 via-transparent to-transparent",
  },
  Q3: {
    title: "紧急不重要",
    pixelTitle: "⚡ 突发委托",
    desc: "干扰、某些会议",
    textClass: "text-amber-600 dark:text-amber-400",
    badgeBgClass: "bg-amber-500",
    iconTextClass: "text-amber-500",
    accentBorder: "border-t-4 border-t-amber-500",
    bgGradient: "bg-gradient-to-b from-amber-500/5 via-transparent to-transparent",
  },
  Q4: {
    title: "不重要不紧急",
    pixelTitle: "💧 支线见闻",
    desc: "琐事、消遣",
    textClass: "text-slate-600 dark:text-slate-400",
    badgeBgClass: "bg-slate-500",
    iconTextClass: "text-slate-500",
    accentBorder: "border-t-4 border-t-slate-500",
    bgGradient: "bg-gradient-to-b from-slate-500/5 via-transparent to-transparent",
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getScheduleGroup(scheduledEndAt: number | undefined, now: number): string {
  if (!scheduledEndAt) return "无日期";
  if (scheduledEndAt < now) return "已过期";
  const diffDays = (scheduledEndAt - now) / MS_PER_DAY;
  if (diffDays <= 1) return "一天内";
  if (diffDays <= 3) return "三天内";
  if (diffDays <= 7) return "一周内";
  return "一周外";
}

function getDefaultScheduleEndForGroup(groupName: string, now: number): number | undefined {
  if (groupName === "已过期") return now - 3600 * 1000;
  if (groupName === "一天内") {
    const d = new Date(now + MS_PER_DAY);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  if (groupName === "三天内") {
    const d = new Date(now + 3 * MS_PER_DAY);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  if (groupName === "一周内") {
    const d = new Date(now + 7 * MS_PER_DAY);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  if (groupName === "一周外") {
    const d = new Date(now + 8 * MS_PER_DAY);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  return undefined;
}

export const DailyQuadrants: React.FC<DailyQuadrantsProps> = memo(
  ({
    tasks,
    onToggleComplete,
    onCreateTask,
    hideCompleted,
    onDeleteTask,
    onEditTask,
    onUpdateTask,
    onMoveAndReorderTask,
  }) => {
    const { isPixelTheme } = useAppThemeStyle();
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<"top" | "bottom" | null>(null);

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
      setDraggedTaskId(taskId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/tm-task-id", taskId);
      e.dataTransfer.setData("text/plain", taskId);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    };

    const handleDropOnQuadrant = (e: React.DragEvent, targetQuadrant: QuadrantType) => {
      e.preventDefault();
      e.stopPropagation();
      const taskId =
        e.dataTransfer.getData("application/tm-task-id") ||
        e.dataTransfer.getData("text/plain") ||
        draggedTaskId;
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      setDropPosition(null);

      if (taskId) {
        onUpdateTask(taskId, { quadrant: targetQuadrant });
      }
    };

    const handleDragOverTask = (e: React.DragEvent, taskId: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (taskId === draggedTaskId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const position = relativeY > rect.height / 2 ? "bottom" : "top";

      setDragOverTaskId(taskId);
      setDropPosition(position);
    };

    const handleDragLeaveTask = () => {
      setDragOverTaskId(null);
      setDropPosition(null);
    };

    const handleDropOnTask = (e: React.DragEvent, targetTask: Task) => {
      e.preventDefault();
      e.stopPropagation();

      const taskId =
        e.dataTransfer.getData("application/tm-task-id") ||
        e.dataTransfer.getData("text/plain") ||
        draggedTaskId;
      setDragOverTaskId(null);
      setDropPosition(null);
      setDraggedTaskId(null);

      if (!taskId || taskId === targetTask.id) return;

      const movedTask = tasks.find((task) => task.id === taskId);
      if (!movedTask) return;

      const updates = {
        quadrant: targetTask.quadrant,
        scheduleMode: targetTask.scheduleMode,
        scheduledStartAt: targetTask.scheduledStartAt,
        scheduledEndAt: targetTask.scheduledEndAt,
      };

      // Completion is an independent task state. Moving across its visual
      // divider changes the destination fields but does not silently complete
      // or reopen the task, so there is no shared order set to reindex.
      if (movedTask.completed !== targetTask.completed) {
        onUpdateTask(taskId, updates);
        return;
      }

      const now = Date.now();
      const targetGroup = getScheduleGroup(targetTask.scheduledEndAt, now);

      const sameGroupTasks = tasks
        .filter(
          (t) =>
            t.quadrant === targetTask.quadrant &&
            t.completed === movedTask.completed &&
            getScheduleGroup(t.scheduledEndAt, now) === targetGroup &&
            t.id !== taskId
        )
        .sort((a, b) => (b.sortOrder ?? -1) - (a.sortOrder ?? -1));

      const yIndex = sameGroupTasks.findIndex((t) => t.id === targetTask.id);
      if (yIndex === -1) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const isBelow = relativeY > rect.height / 2;
      const orderedTasks = [...sameGroupTasks];
      orderedTasks.splice(isBelow ? yIndex + 1 : yIndex, 0, movedTask);

      // A just-created task has no database version yet. Its first save assigns
      // an initial order; only persisted task sets may enter a versioned reorder.
      if (orderedTasks.every((task) => task.lockVersion !== undefined && task.sortOrder !== undefined)) {
        onMoveAndReorderTask(taskId, updates, orderedTasks.map((task) => task.id));
      } else {
        onUpdateTask(taskId, updates);
      }
    };

    const handleDropOnGroup = (
      e: React.DragEvent,
      targetQuadrant: QuadrantType,
      groupName: string
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const taskId =
        e.dataTransfer.getData("application/tm-task-id") ||
        e.dataTransfer.getData("text/plain") ||
        draggedTaskId;
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      setDropPosition(null);

      if (!taskId) return;

      const now = Date.now();
      const targetScheduledEndAt = getDefaultScheduleEndForGroup(groupName, now);

      onUpdateTask(taskId, {
        quadrant: targetQuadrant,
        scheduleMode: targetScheduledEndAt ? "point" : undefined,
        scheduledStartAt: undefined,
        scheduledEndAt: targetScheduledEndAt,
      });
    };

    const renderTasks = (taskList: Task[], iconTextClass: string) => {
      const now = Date.now();
      return taskList.map((task) => {
        const isHovered = dragOverTaskId === task.id;
        const isExpired = task.scheduledEndAt && task.scheduledEndAt < now && !task.completed;
        const hasContent = hasTaskDescription(task.description);

        return (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragOver={(e) => handleDragOverTask(e, task.id)}
            onDragLeave={handleDragLeaveTask}
            onDrop={(e) => handleDropOnTask(e, task)}
            onClick={(e) => onEditTask(task, e.currentTarget)}
            className={`group flex items-center justify-between transition-all cursor-grab active:cursor-grabbing select-none ${isPixelTheme
                ? "px-3 py-2 rounded-xs border border-border/80 bg-card hover:bg-amber-100/60 dark:hover:bg-amber-950/40 shadow-[1px_1px_0px_rgba(0,0,0,0.06)] font-mono text-foreground"
                : "px-2.5 py-1.5 rounded-lg border-b border-slate-200/50 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
              } ${task.completed ? (isPixelTheme ? "opacity-60 line-through bg-muted/40" : "opacity-60 line-through") : ""} ${isHovered && dropPosition === "top"
                ? isPixelTheme
                  ? "border-t-2 border-t-amber-600 bg-amber-500/10"
                  : "border-t-2 border-t-blue-600"
                : isHovered && dropPosition === "bottom"
                  ? isPixelTheme
                    ? "border-b-2 border-b-amber-600 bg-amber-500/10"
                    : "border-b-2 border-b-blue-600"
                  : ""
              }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete(task.id);
                }}
                className={`flex-shrink-0 cursor-pointer transition-all ${isPixelTheme
                    ? `size-4 rounded-xs flex items-center justify-center ${task.completed
                      ? "bg-emerald-600 text-white border border-emerald-800 shadow-[1px_1px_0px_#064e3b]"
                      : "border-2 border-amber-900/60 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:border-emerald-500 shadow-[1px_1px_0px_#000]"
                    }`
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
              >
                {isPixelTheme ? (
                  task.completed && <Check size={11} className="stroke-[3]" />
                ) : task.completed ? (
                  <CheckCircle2 size={16} className={iconTextClass} />
                ) : (
                  <Circle size={16} />
                )}
              </button>

              <span
                className={`text-xs font-medium truncate ${isPixelTheme ? "font-mono text-foreground" : "text-slate-800 dark:text-slate-200"
                  }`}
              >
                {task.title}
              </span>

              {isExpired && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    onUpdateTask(task.id, {
                      scheduleMode: "point",
                      scheduledStartAt: undefined,
                      scheduledEndAt: today.getTime(),
                    });
                  }}
                  title="点击延期至今日"
                  className={`text-[10px] font-medium flex-shrink-0 transition-colors cursor-pointer group/tag ${isPixelTheme
                      ? "rounded-xs border-2 border-red-800 bg-red-100/90 dark:bg-red-950/70 text-red-700 dark:text-red-300 font-mono px-1.5 py-0.5 shadow-[1px_1px_0px_#7f1d1d] hover:bg-red-600 hover:text-white"
                      : "rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 px-1.5 py-0.5 hover:bg-red-600 hover:text-white"
                    }`}
                >
                  <span className="group-hover/tag:hidden">已过期</span>
                  <span className="hidden group-hover/tag:inline">延期</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-end flex-shrink-0 ml-2 size-6">
              {hasContent ? (
                <span
                  title="包含任务详情"
                  className="flex items-center justify-center size-6 text-muted-foreground group-hover:hidden transition-all"
                >
                  <AlignLeft size={13} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="size-6 invisible group-hover:hidden pointer-events-none"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask(task.id);
                }}
                className={`hidden group-hover:flex h-6 w-6 cursor-pointer ${
                  isPixelTheme
                    ? "rounded-xs border border-border/80 bg-muted hover:bg-red-600 hover:text-white text-muted-foreground shadow-[1px_1px_0px_#000]"
                    : "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                }`}
                title="删除任务"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        );
      });
    };

    const renderQuadrantBox = (type: QuadrantType) => {
      const config = QUADRANT_CONFIG[type];
      let qTasks = tasks.filter((t) => t.quadrant === type);

      if (hideCompleted) {
        qTasks = qTasks.filter((t) => !t.completed);
      }

      const sortedTasks = [...qTasks].sort((a, b) => {
        if (a.completed === b.completed) return (b.sortOrder ?? -1) - (a.sortOrder ?? -1);
        return a.completed ? 1 : -1;
      });

      const now = Date.now();
      const expired: Task[] = [];
      const noDate: Task[] = [];
      const within1Day: Task[] = [];
      const within3Days: Task[] = [];
      const within1Week: Task[] = [];
      const beyond1Week: Task[] = [];

      sortedTasks.forEach((t) => {
        if (!t.scheduledEndAt) {
          noDate.push(t);
        } else if (t.scheduledEndAt < now && !t.completed) {
          expired.push(t);
        } else {
          const diffDays = (t.scheduledEndAt - now) / MS_PER_DAY;
          if (diffDays <= 1) within1Day.push(t);
          else if (diffDays <= 3) within3Days.push(t);
          else if (diffDays <= 7) within1Week.push(t);
          else beyond1Week.push(t);
        }
      });

      return (
        <div
          key={type}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropOnQuadrant(e, type)}
          className={`flex flex-col h-full ${isPixelTheme
              ? "rounded-xl border-2 border-border/90 bg-card shadow-[4px_4px_0px_rgba(0,0,0,0.12)] font-mono"
              : "rounded-t-2xl rounded-b-none border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
            } ${config.accentBorder} ${config.bgGradient} overflow-hidden select-none`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60" onDragOver={handleDragOver}>
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 ${isPixelTheme ? "rounded-xs font-mono font-black border border-black/40 shadow-[1px_1px_0px_#000]" : "rounded-full font-bold"
                  } text-white text-xs flex items-center justify-center shadow-xs ${config.badgeBgClass}`}
              >
                {type[1]}
              </span>
              <div>
                <h3 className={`text-sm font-bold ${config.textClass} ${isPixelTheme ? "font-mono" : ""}`}>
                  {isPixelTheme ? config.pixelTitle : config.title}
                </h3>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => onCreateTask(type, e.currentTarget)}
              className={
                isPixelTheme
                  ? "h-7 w-7 rounded-xs border-2 border-border bg-muted hover:bg-card text-foreground shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                  : "h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
              }
              title="新建任务"
            >
              <Plus size={16} strokeWidth={isPixelTheme ? 2.5 : 2} />
            </Button>
          </div>

          {/* Task List by Group or Empty State */}
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1" onDragOver={handleDragOver}>
            {sortedTasks.length === 0 ? (
              <div
                onClick={(e) => onCreateTask(type, e.currentTarget)}
                className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50 hover:text-muted-foreground text-xs gap-1.5 cursor-pointer select-none transition-colors min-h-[100px]"
                title="点击新建任务"
              >
                <span className="text-base">{isPixelTheme ? "📜" : "✨"}</span>
                <span className={isPixelTheme ? "font-mono" : ""}>
                  {isPixelTheme ? "暂无委托 · 点击添加" : "暂无任务 · 点击添加"}
                </span>
              </div>
            ) : (
              <>
                {expired.length > 0 && (
                  <div onDragOver={handleDragOver} onDrop={(e) => handleDropOnGroup(e, type, "已过期")}>
                    <CollapsibleGroup title="已过期" count={expired.length} isExpired>
                      {renderTasks(expired, config.iconTextClass)}
                    </CollapsibleGroup>
                  </div>
                )}
                {within1Day.length > 0 && (
                  <div onDragOver={handleDragOver} onDrop={(e) => handleDropOnGroup(e, type, "一天内")}>
                    <CollapsibleGroup title="一天内" count={within1Day.length}>
                      {renderTasks(within1Day, config.iconTextClass)}
                    </CollapsibleGroup>
                  </div>
                )}
                {within3Days.length > 0 && (
                  <div onDragOver={handleDragOver} onDrop={(e) => handleDropOnGroup(e, type, "三天内")}>
                    <CollapsibleGroup title="三天内" count={within3Days.length}>
                      {renderTasks(within3Days, config.iconTextClass)}
                    </CollapsibleGroup>
                  </div>
                )}
                {within1Week.length > 0 && (
                  <div onDragOver={handleDragOver} onDrop={(e) => handleDropOnGroup(e, type, "一周内")}>
                    <CollapsibleGroup title="一周内" count={within1Week.length}>
                      {renderTasks(within1Week, config.iconTextClass)}
                    </CollapsibleGroup>
                  </div>
                )}
                {beyond1Week.length > 0 && (
                  <div onDragOver={handleDragOver} onDrop={(e) => handleDropOnGroup(e, type, "一周外")}>
                    <CollapsibleGroup title="一周外" count={beyond1Week.length}>
                      {renderTasks(beyond1Week, config.iconTextClass)}
                    </CollapsibleGroup>
                  </div>
                )}
                {noDate.length > 0 && (
                  <div onDragOver={handleDragOver} onDrop={(e) => handleDropOnGroup(e, type, "无日期")}>
                    <CollapsibleGroup title="无日期" count={noDate.length}>
                      {renderTasks(noDate, config.iconTextClass)}
                    </CollapsibleGroup>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full flex-1 min-h-0" onDragOver={handleDragOver}>
        {renderQuadrantBox("Q1")}
        {renderQuadrantBox("Q2")}
        {renderQuadrantBox("Q3")}
        {renderQuadrantBox("Q4")}
      </div>
    );
  }
);
