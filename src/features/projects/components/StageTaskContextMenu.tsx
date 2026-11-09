import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, RotateCcw, Edit3, Trash2 } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";
import type { ProjectTask } from "@/types/project";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface StageTaskContextMenuProps {
  task: ProjectTask | null;
  isOpen: boolean;
  position: ContextMenuPosition;
  canRollback: boolean;
  isSnapshot?: boolean;
  onClose: () => void;
  onDirectComplete: (task: ProjectTask) => void;
  onRollback: (task: ProjectTask) => void;
  onOpenEdit: (task: ProjectTask) => void;
  onDelete: (taskId: string) => void;
}

export function StageTaskContextMenu({
  task,
  isOpen,
  position,
  canRollback,
  isSnapshot = false,
  onClose,
  onDirectComplete,
  onRollback,
  onOpenEdit,
  onDelete,
}: StageTaskContextMenuProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  // Viewport containment adjustment
  const menuWidth = 180;
  const menuHeight = 170;
  const padding = 10;
  const x = Math.min(position.x, window.innerWidth - menuWidth - padding);
  const y = Math.min(position.y, window.innerHeight - menuHeight - padding);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${Math.max(padding, x)}px`, top: `${Math.max(padding, y)}px` }}
      className={cn(
        "fixed z-[9999] min-w-[170px] py-1 shadow-xl select-none animate-in fade-in-50 zoom-in-95 duration-100",
        isPixelTheme
          ? "rounded-xs border-2 border-border/90 bg-card font-mono shadow-[3px_3px_0px_#000] text-foreground text-xs"
          : "rounded-lg border border-border/80 bg-popover text-popover-foreground text-xs backdrop-blur-md"
      )}
    >
      <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/60 truncate">
        {task.title}
      </div>

      {!isSnapshot && !task.completed && (
        <button
          type="button"
          onClick={() => {
            onDirectComplete(task);
            onClose();
          }}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer",
            isPixelTheme
              ? "hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold"
              : "hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-medium"
          )}
        >
          <CheckCircle2 size={13} />
          <span>直接标记完成</span>
        </button>
      )}

      {canRollback && !isSnapshot && (
        <button
          type="button"
          onClick={() => {
            onRollback(task);
            onClose();
          }}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer",
            isPixelTheme
              ? "hover:bg-amber-100 dark:hover:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold"
              : "hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-medium"
          )}
        >
          <RotateCcw size={13} />
          <span>退回上一阶段</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          onOpenEdit(task);
          onClose();
        }}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer",
          isPixelTheme ? "hover:bg-muted font-bold" : "hover:bg-muted font-medium"
        )}
      >
        <Edit3 size={13} />
        <span>查看/编辑属性</span>
      </button>

      {!isSnapshot && (
        <div className="border-t border-border/60 my-0.5">
          <button
            type="button"
            onClick={() => {
              onDelete(task.id);
              onClose();
            }}
            className={cn(
              "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-destructive transition-colors cursor-pointer",
              isPixelTheme ? "hover:bg-red-100 dark:hover:bg-red-950 font-bold" : "hover:bg-destructive/10 font-medium"
            )}
          >
            <Trash2 size={13} />
            <span>删除任务</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
