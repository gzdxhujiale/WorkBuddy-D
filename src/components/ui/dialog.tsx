import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      {/* Container */}
      <div className="relative z-50 w-full max-w-lg">
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogContent({
  className,
  children,
  onClose,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }) {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <div
      className={cn(
        "bg-card text-card-foreground overflow-visible animate-in fade-in zoom-in-95 duration-200 p-6 flex flex-col gap-4",
        isPixelTheme
          ? "rounded-xs border-2 border-border shadow-[4px_4px_0px_#000] font-mono"
          : "rounded-2xl border border-border shadow-2xl",
        className
      )}
      {...props}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute right-4 top-4 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
            isPixelTheme
              ? "rounded-xs border border-border bg-muted hover:bg-accent shadow-[1px_1px_0px_#000]"
              : "rounded-full hover:bg-accent"
          )}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <h3
      className={cn(
        "text-lg font-bold text-foreground leading-none tracking-tight",
        isPixelTheme && "font-mono",
        className
      )}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <p
      className={cn(
        "text-sm text-muted-foreground leading-relaxed",
        isPixelTheme && "font-mono text-xs",
        className
      )}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 pt-2",
        isPixelTheme ? "border-t-2 border-border font-mono" : "border-t border-border",
        className
      )}
      {...props}
    />
  );
}
