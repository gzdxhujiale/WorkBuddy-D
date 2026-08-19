import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  close: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export function useDropdownMenu() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("useDropdownMenu must be used within a DropdownMenu");
  }
  return context;
}

export interface DropdownMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function DropdownMenu({ open: controlledOpen, onOpenChange, children }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerRef = useRef<HTMLElement | null>(null);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const toggleOpen = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, toggleOpen, close, triggerRef }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function DropdownMenuTrigger({ asChild, children, className, onClick, ...props }: DropdownMenuTriggerProps) {
  const { toggleOpen, triggerRef } = useDropdownMenu();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.(e);
    toggleOpen();
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: triggerRef,
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        (children as React.ReactElement<any>).props.onClick?.(e);
        handleClick(e);
      },
    });
  }

  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      type="button"
      className={cn("cursor-pointer select-none", className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
  sideOffset?: number;
  width?: string;
}

export function DropdownMenuContent({
  align = "end",
  sideOffset = 4,
  className,
  children,
  style,
  ...props
}: DropdownMenuContentProps) {
  const { open, close, triggerRef } = useDropdownMenu();
  const { isPixelTheme } = useAppThemeStyle();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (target instanceof Element && target.closest("[data-dropdown-menu-overlay]")) {
        return;
      }
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      style={{
        marginTop: `${sideOffset}px`,
        ...style,
      }}
      className={cn(
        "absolute top-full z-50 min-w-36 p-1 bg-popover text-popover-foreground flex flex-col animate-in fade-in zoom-in-95 duration-100",
        align === "end" ? "right-0" : "left-0",
        isPixelTheme
          ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
          : "border border-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
  closeOnClick?: boolean;
}

export function DropdownMenuItem({
  destructive = false,
  closeOnClick = true,
  className,
  children,
  onClick,
  disabled,
  ...props
}: DropdownMenuItemProps) {
  const { close } = useDropdownMenu();
  const { isPixelTheme } = useAppThemeStyle();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.stopPropagation();
    onClick?.(e);
    if (closeOnClick) {
      close();
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "w-full text-left px-2.5 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-start gap-2 select-none",
        isPixelTheme ? "rounded-xs font-mono" : "rounded-lg",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("h-px bg-border my-1 -mx-1", className)} />;
}
