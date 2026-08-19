import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "right" | "left" | "bottom";
  className?: string;
  children: React.ReactNode;
}

export function Drawer({ open, onOpenChange, side = "right", className, children }: DrawerProps) {
  const { isPixelTheme } = useAppThemeStyle();
  if (!open) return null;

  const sideClasses = {
    right: cn(
      "top-0 right-0 h-full w-[440px] max-w-full animate-in slide-in-from-right duration-300",
      isPixelTheme ? "border-l-2" : "border-l"
    ),
    left: cn(
      "top-0 left-0 h-full w-[440px] max-w-full animate-in slide-in-from-left duration-300",
      isPixelTheme ? "border-r-2" : "border-r"
    ),
    bottom: cn(
      "bottom-0 left-0 right-0 w-full max-h-[85vh] animate-in slide-in-from-bottom duration-300",
      isPixelTheme ? "border-t-2 rounded-t-xs" : "border-t rounded-t-2xl"
    ),
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        className={cn(
          "absolute bg-card text-card-foreground border-border flex flex-col z-50",
          isPixelTheme
            ? "shadow-[4px_4px_0px_#000] font-mono"
            : "shadow-2xl",
          sideClasses[side],
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DrawerHeader({ className, children, onClose, ...props }: React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }) {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <div
      className={cn(
        "h-16 flex items-center justify-between px-6 flex-shrink-0",
        isPixelTheme ? "border-b-2 border-border font-mono" : "border-b border-border",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
            isPixelTheme
              ? "rounded-xs border border-border bg-muted hover:bg-accent shadow-[1px_1px_0px_#000]"
              : "rounded-lg hover:bg-accent"
          )}
        >
          <X className="size-5" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  );
}

export function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <h2
      className={cn(
        "text-lg font-bold text-foreground truncate",
        isPixelTheme && "font-mono",
        className
      )}
      {...props}
    />
  );
}

export function DrawerContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-6 flex flex-col gap-6", className)} {...props} />;
}
