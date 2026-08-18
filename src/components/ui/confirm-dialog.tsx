import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";

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
  const { isPixelTheme } = useAppThemeStyle();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    arrowStyle: React.CSSProperties;
  }>({
    top: 0,
    left: 0,
    arrowStyle: {},
  });

  const updatePosition = useCallback(() => {
    const popoverEl = popoverRef.current;
    const width = popoverEl ? popoverEl.offsetWidth : 280;
    const height = popoverEl ? popoverEl.offsetHeight : 120;
    const gap = 8;
    const arrowSize = 6;
    const padding = 8;

    let rect: DOMRect | null = null;
    if (target) {
      if ("getBoundingClientRect" in target && typeof (target as HTMLElement).getBoundingClientRect === "function") {
        rect = (target as HTMLElement).getBoundingClientRect();
      } else if ("clientX" in target && "clientY" in target) {
        const mouseEvent = target as React.MouseEvent;
        rect = new DOMRect(mouseEvent.clientX, mouseEvent.clientY, 0, 0);
      }
    } else if (typeof document !== "undefined" && document.activeElement && document.activeElement !== document.body) {
      rect = document.activeElement.getBoundingClientRect();
    }

    if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
      setCoords({
        top: Math.max(padding, window.innerHeight / 2 - height / 2),
        left: Math.max(padding, window.innerWidth / 2 - width / 2),
        arrowStyle: { display: "none" },
      });
      return;
    }

    // Default try to position above target
    let top = rect.top - height - gap;
    let left = rect.left + rect.width / 2 - width / 2;
    let arrowStyle: React.CSSProperties = {
      bottom: -arrowSize / 2,
      left: "50%",
      transform: "translateX(-50%) rotate(45deg)",
      borderRight: "1px solid var(--color-border)",
      borderBottom: "1px solid var(--color-border)",
    };

    // If top overflows screen, flip to bottom
    if (top < padding) {
      top = rect.bottom + gap;
      arrowStyle = {
        top: -arrowSize / 2,
        left: "50%",
        transform: "translateX(-50%) rotate(45deg)",
        borderLeft: "1px solid var(--color-border)",
        borderTop: "1px solid var(--color-border)",
      };
    }

    // Keep horizontally within viewport
    const originalLeft = left;
    if (left + width > window.innerWidth - padding) {
      left = window.innerWidth - width - padding;
    }
    if (left < padding) {
      left = padding;
    }

    // Adjust arrow offset if popover shifted horizontally
    const shift = left - originalLeft;
    if (Math.abs(shift) > 2) {
      const arrowLeft = Math.max(16, Math.min(width - 16, width / 2 - shift));
      arrowStyle.left = arrowLeft;
      arrowStyle.transform = "rotate(45deg)";
    }

    setCoords({ top, left, arrowStyle });
  }, [target]);

  useEffect(() => {
    if (open) {
      updatePosition();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onOpenChange(false);
      };
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open, updatePosition, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1050] select-none">
      {/* Invisible backdrop for seamless click-outside dismiss */}
      <div
        className="fixed inset-0 bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
      />
      {/* Arco Popconfirm Card */}
      <div
        ref={popoverRef}
        style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
        className={cn(
          "fixed z-[1060] min-w-[220px] max-w-[320px] p-3.5 animate-in fade-in zoom-in-95 duration-150 flex flex-col",
          isPixelTheme
            ? "rounded-xl border-2 border-border bg-card text-foreground font-mono shadow-[4px_4px_0px_#000]"
            : "rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow pointer */}
        {!isPixelTheme && <div style={coords.arrowStyle} className="absolute size-2 bg-popover z-10" />}

        <div className="flex items-start gap-2.5">
          {variant === "destructive" ? (
            <AlertCircle className="size-4 shrink-0 text-[#f53f3f] dark:text-[#f76560] mt-0.5" />
          ) : (
            <AlertTriangle className="size-4 shrink-0 text-[#ff7d00] dark:text-[#ff9a2e] mt-0.5" />
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-foreground leading-snug break-words">{title}</h4>
            {description && (
              <p className="text-[12px] text-muted-foreground leading-relaxed mt-1 break-words">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-3 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
            }}
            className={cn(
              "inline-flex items-center justify-center h-6 px-2.5 text-xs transition-colors cursor-pointer select-none",
              isPixelTheme
                ? "rounded-xs border border-border bg-muted hover:bg-accent text-foreground shadow-[1px_1px_0px_#000]"
                : "rounded border border-border bg-transparent text-foreground hover:bg-muted active:bg-muted/80"
            )}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
              onOpenChange(false);
            }}
            className={cn(
              "inline-flex items-center justify-center h-6 px-2.5 text-xs font-medium text-white transition-colors cursor-pointer select-none",
              isPixelTheme ? "rounded-xs shadow-[1px_1px_0px_#000] font-bold" : "rounded shadow-xs",
              variant === "destructive"
                ? isPixelTheme
                  ? "bg-red-700 hover:bg-red-800 active:bg-red-900 border border-red-950 text-white"
                  : "bg-[#f53f3f] hover:bg-[#e03535] active:bg-[#cb2727] dark:bg-[#f76560] dark:hover:bg-[#f53f3f]"
                : isPixelTheme
                  ? "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 border border-amber-900 text-white"
                  : "bg-[#165dff] hover:bg-[#0e42d2] active:bg-[#0935b5] dark:bg-[#3c7eff] dark:hover:bg-[#165dff]"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
