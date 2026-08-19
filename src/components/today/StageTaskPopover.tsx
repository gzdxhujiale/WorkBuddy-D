import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Check,
  Plus,
  ArrowUpRight,
  AlignLeft,
  Calendar,
  FolderKanban,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelScroll, PixelShield } from "@/components/pixel/PixelIcons";
import { hasTaskDescription } from "@/lib/taskDescription";
import { openQuickEditWindow } from "@/services/quickEditWindow";
import { cn } from "@/lib/utils";
import type { Project, ProjectStage, ProjectTask } from "@/types/projects";
import type { Task } from "@/types/timeManagement";

interface StageTaskPopoverProps {
  project?: Project;
  stage: ProjectStage;
  tasks: ProjectTask[];
  anchorRect: DOMRect | null;
  onClose: () => void;
  onToggleTask: (task: ProjectTask) => void;
  onAddTask: (title: string) => Promise<void>;
  onNavigateToProject: () => void;
}

export const StageTaskPopover: React.FC<StageTaskPopoverProps> = ({
  project,
  stage,
  tasks,
  anchorRect,
  onClose,
  onToggleTask,
  onAddTask,
  onNavigateToProject,
}) => {
  const { isPixelTheme } = useAppThemeStyle();
  const [quickTitle, setQuickTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title || isAdding) return;
    setIsAdding(true);
    try {
      await onAddTask(title);
      setQuickTitle("");
    } finally {
      setIsAdding(false);
    }
  };

  const handleTaskClick = (task: ProjectTask, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    void openQuickEditWindow({
      task: task as Task,
      anchorEl: e.currentTarget,
      onCommit: (_taskId, _updates) => {
        // Query invalidation takes care of sync
      },
      onClosed: () => {},
    });
  };

  const [position, setPosition] = useState<{ left: number; top: number; placement: "top" | "bottom"; arrowLeft: number }>({
    left: 0,
    top: 0,
    placement: "top",
    arrowLeft: 180,
  });

  const updatePosition = () => {
    if (!anchorRect) return;
    const el = popoverRef.current;
    const popoverWidth = el?.offsetWidth || 380;
    const popoverHeight = el?.offsetHeight || 320;
    const gap = 8;
    const padding = 16;

    const centerX = anchorRect.left + anchorRect.width / 2;
    const left = Math.max(
      padding,
      Math.min(window.innerWidth - popoverWidth - padding, centerX - popoverWidth / 2)
    );

    const spaceAbove = anchorRect.top;
    const spaceBelow = window.innerHeight - anchorRect.bottom;

    let top = 0;
    let placement: "top" | "bottom" = "top";

    if (spaceAbove >= popoverHeight + gap || spaceAbove > spaceBelow) {
      top = anchorRect.top - popoverHeight - gap;
      placement = "top";
    } else {
      top = anchorRect.bottom + gap;
      placement = "bottom";
    }

    top = Math.max(padding, Math.min(window.innerHeight - popoverHeight - padding, top));
    const arrowLeft = Math.max(16, Math.min(popoverWidth - 24, centerX - left - 6));

    setPosition({ left, top, placement, arrowLeft });
  };

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRect, tasks.length]);

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: "380px",
        zIndex: 9999,
      }}
      className={cn(
        "flex flex-col bg-popover text-popover-foreground border shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none max-h-[420px]",
        isPixelTheme
          ? "rounded-xs border-2 border-border font-mono shadow-[4px_4px_0px_rgba(0,0,0,0.25)]"
          : "rounded-2xl border-border/80"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 bg-muted/40",
        isPixelTheme ? "border-b-2 border-border font-mono" : "border-border/70"
      )}>
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            {isPixelTheme ? (
              <PixelShield size={14} className="shrink-0 text-amber-600" />
            ) : (
              <FolderKanban size={13} className="shrink-0 text-sky-500" />
            )}
            <span className="truncate font-semibold text-foreground/90">
              {project?.name ?? "未知项目"}
            </span>
            <span>·</span>
            <span className="truncate">{stage.name}</span>
          </div>
          {(stage.startDate || stage.endDate) && (
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              📅 {stage.startDate ?? "未设"} ~ {stage.endDate ?? "未设"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToProject}
            className={cn(
              "h-7 px-2 text-[11px] gap-1 font-semibold text-muted-foreground hover:text-foreground cursor-pointer",
              isPixelTheme ? "rounded-xs border border-border bg-card shadow-[1px_1px_0px_#000]" : "rounded-lg"
            )}
            title="在项目中心打开全景看板"
          >
            <span>项目</span>
            <ArrowUpRight size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              "size-7 text-muted-foreground hover:text-foreground cursor-pointer",
              isPixelTheme ? "rounded-xs" : "rounded-md"
            )}
            title="关闭"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Progress Stats */}
      <div className={cn(
        "px-3.5 py-2 border-b bg-card shrink-0 flex items-center justify-between gap-3 text-xs",
        isPixelTheme ? "border-b-2 border-border font-mono" : "border-border/60"
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn(
            "flex-1 overflow-hidden",
            isPixelTheme ? "h-2.5 rounded-xs border border-border bg-muted/60 p-[1px]" : "h-2 rounded-full bg-muted"
          )}>
            <div
              className={cn(
                "h-full transition-all duration-300",
                isPixelTheme ? "bg-amber-500 rounded-xs" : "bg-emerald-500 rounded-full"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="font-bold tabular-nums text-foreground shrink-0 text-[11px]">
            {percent}%
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          已完成 {completedCount}/{totalCount}
        </span>
      </div>

      {/* Task List (Scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-24 max-h-48 divide-y divide-border/40 p-1">
        {tasks.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-muted-foreground text-xs gap-1">
            {isPixelTheme ? (
              <PixelScroll size={22} className="opacity-50" />
            ) : (
              <CheckCircle2 size={20} className="opacity-40" />
            )}
            <span>该阶段暂无任务</span>
          </div>
        ) : (
          tasks.map((task) => {
            const hasContent = hasTaskDescription(task.description);
            return (
              <div
                key={task.id}
                onClick={(e) => handleTaskClick(task, e)}
                className={cn(
                  "group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer select-none",
                  isPixelTheme
                    ? "hover:bg-amber-100/60 dark:hover:bg-amber-950/40 font-mono"
                    : "hover:bg-accent/60",
                  task.completed && "opacity-60"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task);
                    }}
                    className={cn(
                      "size-4 flex items-center justify-center shrink-0 transition-all cursor-pointer",
                      isPixelTheme
                        ? "rounded-xs border border-border"
                        : "rounded-full border border-slate-300 dark:border-slate-600",
                      task.completed
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : "bg-background hover:border-emerald-500"
                    )}
                  >
                    {task.completed && <Check size={10} className="stroke-[3]" />}
                  </button>

                  <span
                    className={cn(
                      "truncate text-xs font-medium text-foreground",
                      task.completed && "line-through text-muted-foreground"
                    )}
                  >
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                  {hasContent && (
                    <span title="包含任务详情" className="opacity-70">
                      <AlignLeft size={12} />
                    </span>
                  )}
                  {task.scheduledEndAt && (
                    <span className="text-[10px] tabular-nums font-mono opacity-80 flex items-center gap-0.5">
                      <Calendar size={10} />
                      {new Date(task.scheduledEndAt).getMonth() + 1}.
                      {new Date(task.scheduledEndAt).getDate()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Add Input Bar */}
      <form
        onSubmit={handleQuickAddSubmit}
        className={cn(
          "flex items-center gap-1.5 p-2 border-t bg-muted/20 shrink-0",
          isPixelTheme ? "border-t-2 border-border font-mono" : "border-border/70"
        )}
      >
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder={
            isPixelTheme
              ? "📜 快速添加阶段任务... (按 Enter)"
              : "快速添加阶段任务... (按 Enter 保存)"
          }
          className={cn(
            "flex-1 bg-background border px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-ring text-foreground",
            isPixelTheme ? "rounded-xs border-border/80" : "rounded-lg border-border"
          )}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!quickTitle.trim() || isAdding}
          className={cn(
            "h-7 px-2.5 text-xs gap-1 cursor-pointer shrink-0",
            isPixelTheme ? "rounded-xs border border-border shadow-[1px_1px_0px_#000]" : "rounded-lg"
          )}
        >
          <Plus size={13} />
          <span>添加</span>
        </Button>
      </form>
    </div>
  );
};
