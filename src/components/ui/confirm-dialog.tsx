import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
  target?: HTMLElement | React.MouseEvent | null;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  variant = "destructive",
  onConfirm,
  target,
}: ConfirmDialogProps) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const width = 288;
    const height = 135;

    let rect: DOMRect | null = null;
    if (target) {
      if ('getBoundingClientRect' in target && typeof (target as HTMLElement).getBoundingClientRect === 'function') {
        rect = (target as HTMLElement).getBoundingClientRect();
      } else if ('clientX' in target && 'clientY' in target) {
        const mouseEvent = target as React.MouseEvent;
        rect = new DOMRect(mouseEvent.clientX, mouseEvent.clientY, 0, 0);
      }
    } else if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
      rect = document.activeElement.getBoundingClientRect();
    }

    if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
      setPos({
        top: Math.max(20, window.innerHeight / 2 - height / 2),
        left: Math.max(20, window.innerWidth / 2 - width / 2),
      });
      return;
    }

    // Try position above target
    let top = rect.top - height - 8;
    let left = rect.left + rect.width / 2 - width / 2;

    // If top is clipped by screen header, position below target
    if (top < 10) {
      top = rect.bottom + 8;
    }

    // Keep horizontally within viewport
    if (left + width > window.innerWidth - 16) {
      left = window.innerWidth - width - 16;
    }
    if (left < 16) {
      left = 16;
    }

    // Keep vertically within viewport
    if (top + height > window.innerHeight - 16) {
      top = window.innerHeight - height - 16;
    }

    setPos({ top, left });
  }, [target]);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [open, updatePosition]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] select-none pointer-events-auto">
      {/* Light Backdrop */}
      <div
        className="fixed inset-0 bg-black/15 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
        onClick={() => onOpenChange(false)}
      />
      {/* Bubble Popover Container */}
      <div
        style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
        className="fixed z-[1010] w-72 bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3"
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              variant === "destructive"
                ? "bg-destructive/15 text-destructive"
                : "bg-primary/15 text-primary"
            )}
          >
            <AlertTriangle className="size-4" />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h4 className="text-xs font-bold text-foreground leading-snug">{title}</h4>
            {description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs px-2.5 cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="h-7 text-xs px-2.5 cursor-pointer"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
