import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "right" | "left" | "bottom";
  className?: string;
  children: React.ReactNode;
}

export function Drawer({ open, onOpenChange, side = "right", className, children }: DrawerProps) {
  if (!open) return null;

  const sideClasses = {
    right: "top-0 right-0 h-full w-[440px] max-w-full border-l animate-in slide-in-from-right duration-300",
    left: "top-0 left-0 h-full w-[440px] max-w-full border-r animate-in slide-in-from-left duration-300",
    bottom: "bottom-0 left-0 right-0 w-full max-h-[85vh] border-t rounded-t-2xl animate-in slide-in-from-bottom duration-300",
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
          "absolute bg-card text-card-foreground shadow-2xl border-border flex flex-col z-50",
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
  return (
    <div className={cn("h-16 flex items-center justify-between px-6 flex-shrink-0 border-b border-border", className)} {...props}>
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
        >
          <X className="size-5" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  );
}

export function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-bold text-foreground truncate", className)} {...props} />;
}

export function DrawerContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-6 flex flex-col gap-6", className)} {...props} />;
}
