import React, { useState, memo } from "react";
import { Plus, CheckCircle2, Circle, AlignLeft, X, ChevronDown, ChevronRight } from "lucide-react";
import { Task, QuadrantType, Role } from "@/types/timeManagement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CollapsibleGroupProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isExpired?: boolean;
}

const CollapsibleGroup: React.FC<CollapsibleGroupProps> = memo(
  ({ title, count, children, defaultExpanded = true, isExpired = false }) => {
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
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <span
            className={
              isExpired
                ? "text-red-600 dark:text-red-400 font-semibold"
                : "text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-slate-100"
            }
          >
            {title}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
              isExpired
                ? "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
  roles?: Role[];
  onToggleComplete: (taskId: string) => void;
  onCreateTask: (quadrant: QuadrantType, anchorEl?: HTMLElement) => void;
  hideCompleted: boolean;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task, anchorEl?: HTMLElement) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

const QUADRANT_CONFIG: Record<
  QuadrantType,
  {
    title: string;
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
    desc: "危机、急迫的问题",
    textClass: "text-red-600 dark:text-red-400",
    badgeBgClass: "bg-red-500",
    iconTextClass: "text-red-500",
    accentBorder: "border-t-4 border-t-red-500",
    bgGradient: "bg-gradient-to-b from-red-500/5 via-transparent to-transparent",
  },
  Q2: {
    title: "重要不紧急",
    desc: "计划、预防、要事",
    textClass: "text-blue-600 dark:text-blue-400",
    badgeBgClass: "bg-blue-600",
    iconTextClass: "text-blue-600",
    accentBorder: "border-t-4 border-t-blue-600",
    bgGradient: "bg-gradient-to-b from-blue-500/5 via-transparent to-transparent",
  },
  Q3: {
    title: "紧急不重要",
    desc: "干扰、某些会议",
    textClass: "text-amber-600 dark:text-amber-400",
    badgeBgClass: "bg-amber-500",
    iconTextClass: "text-amber-500",
    accentBorder: "border-t-4 border-t-amber-500",
    bgGradient: "bg-gradient-to-b from-amber-500/5 via-transparent to-transparent",
  },
  Q4: {
    title: "不重要不紧急",
    desc: "琐事、消遣",
    textClass: "text-slate-600 dark:text-slate-400",
    badgeBgClass: "bg-slate-500",
    iconTextClass: "text-slate-500",
    accentBorder: "border-t-4 border-t-slate-500",
    bgGradient: "bg-gradient-to-b from-slate-500/5 via-transparent to-transparent",
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDeadlineGroup(deadline: number | undefined, now: number): string {
  if (!deadline) return "无日期";
  if (deadline < now) return "已过期";
  const diffDays = (deadline - now) / MS_PER_DAY;
  if (diffDays <= 1) return "一天内";
  if (diffDays <= 3) return "三天内";
  if (diffDays <= 7) return "一周内";
  return "一周外";
}

function getDefaultDeadlineForGroup(groupName: string, now: number): number | undefined {
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
    roles = [],
    onToggleComplete,
    onCreateTask,
    hideCompleted,
    onDeleteTask,
    onEditTask,
    onUpdateTask,
  }) => {
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

      const targetQTasks = tasks.filter((t) => t.quadrant === targetTask.quadrant);
      const filteredTasks = hideCompleted ? targetQTasks.filter((t) => !t.completed) : targetQTasks;

      const now = Date.now();
      const targetGroup = getDeadlineGroup(targetTask.deadline, now);

      const sameGroupTasks = [...filteredTasks]
        .filter(
          (t) =>
            t.completed === targetTask.completed &&
            getDeadlineGroup(t.deadline, now) === targetGroup &&
            t.id !== taskId
        )
        .sort((a, b) => b.createdAt - a.createdAt);

      const yIndex = sameGroupTasks.findIndex((t) => t.id === targetTask.id);
      if (yIndex === -1) return;

      let newCreatedAt = targetTask.createdAt;

      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const isBelow = relativeY > rect.height / 2;

      if (!isBelow) {
        if (yIndex === 0) {
          newCreatedAt = targetTask.createdAt + 1000;
        } else {
          const prevTask = sameGroupTasks[yIndex - 1];
          newCreatedAt = Math.round((prevTask.createdAt + targetTask.createdAt) / 2);
        }
      } else {
        if (yIndex === sameGroupTasks.length - 1) {
          newCreatedAt = targetTask.createdAt - 1000;
        } else {
          const nextTask = sameGroupTasks[yIndex + 1];
          newCreatedAt = Math.round((targetTask.createdAt + nextTask.createdAt) / 2);
        }
      }

      onUpdateTask(taskId, {
        quadrant: targetTask.quadrant,
        deadline: targetTask.deadline,
        createdAt: newCreatedAt,
      });
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
      const targetDeadline = getDefaultDeadlineForGroup(groupName, now);

      onUpdateTask(taskId, {
        quadrant: targetQuadrant,
        deadline: targetDeadline,
      });
    };

    const roleMap = React.useMemo(() => {
      return new Map((roles || []).map((r) => [r.id, r]));
    }, [roles]);

    const renderTasks = (taskList: Task[], iconTextClass: string) => {
      const now = Date.now();
      return taskList.map((task) => {
        const isHovered = dragOverTaskId === task.id;
        const isExpired = task.deadline && task.deadline < now && !task.completed;
        const hasContent = Boolean(task.description && task.description.trim());
        const role = task.roleId ? roleMap.get(task.roleId) : undefined;

        return (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragOver={(e) => handleDragOverTask(e, task.id)}
            onDragLeave={handleDragLeaveTask}
            onDrop={(e) => handleDropOnTask(e, task)}
            onClick={(e) => onEditTask(task, e.currentTarget)}
            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border-b border-slate-200/50 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-grab active:cursor-grabbing ${
              task.completed ? "opacity-60 line-through" : ""
            } ${
              isHovered && dropPosition === "top"
                ? "border-t-2 border-t-blue-600"
                : isHovered && dropPosition === "bottom"
                ? "border-b-2 border-b-blue-600"
                : ""
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete(task.id);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0 cursor-pointer"
              >
                {task.completed ? (
                  <CheckCircle2 size={16} className={iconTextClass} />
                ) : (
                  <Circle size={16} />
                )}
              </button>

              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                {task.title}
              </span>

              {role && (
                <Badge variant="q2" size="sm" className="flex-shrink-0">
                  {role.name}
                </Badge>
              )}

              {isExpired && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    onUpdateTask(task.id, {
                      deadline: today.getTime(),
                      scheduledDate: todayYMD(),
                    });
                  }}
                  title="点击延期至今日"
                  className="text-[10px] font-medium text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 hover:text-white border border-red-200 dark:border-red-900 px-1.5 py-0.5 rounded-md flex-shrink-0 transition-colors cursor-pointer group/tag"
                >
                  <span className="group-hover/tag:hidden">已过期</span>
                  <span className="hidden group-hover/tag:inline">延期</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {hasContent && (
                <span title="包含任务详情">
                  <AlignLeft size={13} className="text-slate-400" />
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask(task.id);
                }}
                className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
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
        if (a.completed === b.completed) return b.createdAt - a.createdAt;
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
        if (!t.deadline) {
          noDate.push(t);
        } else if (t.deadline < now && !t.completed) {
          expired.push(t);
        } else {
          const diffDays = (t.deadline - now) / MS_PER_DAY;
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
          className={`flex flex-col h-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 ${config.accentBorder} ${config.bgGradient} shadow-xs overflow-hidden select-none`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/80" onDragOver={handleDragOver}>
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs ${config.badgeBgClass}`}
              >
                {type[1]}
              </span>
              <div>
                <h3 className={`text-sm font-bold ${config.textClass}`}>
                  {config.title}
                </h3>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => onCreateTask(type, e.currentTarget)}
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              title="新建任务"
            >
              <Plus size={18} />
            </Button>
          </div>

          {/* Task List by Group */}
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1" onDragOver={handleDragOver}>
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
