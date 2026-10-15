import React, { memo } from "react";
import { Check, Calendar, AlignLeft, FolderKanban, CalendarCheck } from "lucide-react";
import type { Task } from "@/types/task";
import type { Project, ProjectStage } from "@/types/project";
import { hasTaskDescription } from "@/lib/taskDescription";
import { useTodayHighlightStore } from "@/stores/todayHighlightStore";
import { cn } from "@/lib/utils";

export interface TodayTaskItemProps {
  task: Task;
  overdue: boolean;
  due: { text: string; overdue: boolean; isToday: boolean } | null;
  project?: Project;
  stage?: ProjectStage;
  viewMode: "timeline" | "quadrant";
  isPixelTheme?: boolean;
  quadrantDotColor?: string;
  onToggle: (task: Task) => void;
  onReschedule: (task: Task, e: React.MouseEvent) => void;
  onOpenQuickEdit: (task: Task, anchor: HTMLElement) => void;
  hoveredTaskId?: string | null;
  onHoverTask?: (taskId: string | null) => void;
  onHoverStage?: (stageId: string | null) => void;
}

export const TodayTaskItem: React.FC<TodayTaskItemProps> = memo(
  ({
    task,
    overdue,
    due,
    project,
    stage,
    viewMode,
    isPixelTheme,
    quadrantDotColor = "bg-emerald-500",
    onToggle,
    onReschedule,
    onOpenQuickEdit,
    hoveredTaskId,
    onHoverTask,
    onHoverStage,
  }) => {
    const storeHovered = useTodayHighlightStore((s) => s.hoveredTaskId === task.id);
    const isHovered = hoveredTaskId !== undefined ? hoveredTaskId === task.id : storeHovered;
    const storeSetHoveredTask = useTodayHighlightStore((s) => s.setHoveredTask);
    const storeSetHoveredStage = useTodayHighlightStore((s) => s.setHoveredStage);
    const handleHoverTask = onHoverTask ?? storeSetHoveredTask;
    const handleHoverStage = onHoverStage ?? storeSetHoveredStage;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenQuickEdit(task, e.currentTarget);
        }}
        onMouseEnter={() => {
          if (task.projectStageId) handleHoverStage(task.projectStageId);
          handleHoverTask(task.id);
        }}
        onMouseLeave={() => {
          if (task.projectStageId) handleHoverStage(null);
          handleHoverTask(null);
        }}
        className={cn(
          "flex items-center justify-between gap-2.5 px-3.5 py-2.5 transition-all cursor-pointer group select-none text-xs",
          isHovered
            ? isPixelTheme
              ? "bg-amber-100/70 dark:bg-amber-950/60 font-semibold"
              : "bg-muted/60"
            : "hover:bg-muted/30",
          task.completed && "opacity-70 bg-muted/10",
          overdue && "border-l-2 border-l-rose-500 bg-rose-50/30 dark:bg-rose-950/20"
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
              onToggle(task);
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
              className={cn("size-1.5 rounded-full shrink-0", quadrantDotColor)}
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

        {/* Right Side: Due Time, Reschedule Action & Description */}
        <div className="flex items-center gap-2 shrink-0">
          {overdue && (
            <button
              type="button"
              onClick={(e) => onReschedule(task, e)}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium transition-all cursor-pointer",
                isPixelTheme
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/80 dark:hover:bg-amber-900 dark:text-amber-200 border border-amber-800/40 rounded-xs shadow-[1px_1px_0px_#000]"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-md shadow-2xs"
              )}
              title="将截止时间更新为今日 23:59"
            >
              <CalendarCheck size={10} className="shrink-0" />
              <span>顺延至今日</span>
            </button>
          )}

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
  }
);

TodayTaskItem.displayName = "TodayTaskItem";
