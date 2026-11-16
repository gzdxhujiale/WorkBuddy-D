import React, { createContext, useContext, forwardRef } from "react";
import { Menu } from "@base-ui-components/react/menu";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
  close: () => {},
});

export function useDropdownMenu() {
  return useContext(DropdownMenuContext);
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  modal?: boolean;
}

export function DropdownMenu({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  children,
  modal = true,
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const contextValue = React.useMemo<DropdownMenuContextValue>(
    () => ({
      open,
      setOpen: handleOpenChange,
      close: () => handleOpenChange(false),
    }),
    [open, handleOpenChange]
  );

  return (
    <DropdownMenuContext.Provider value={contextValue}>
      <Menu.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        modal={modal}
      >
        {children}
      </Menu.Root>
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Trigger> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
>(({ className, asChild, children, ...props }, ref) => {
  return (
    <Menu.Trigger
      ref={ref}
      render={asChild && React.isValidElement(children) ? (children as React.ReactElement<any>) : undefined}
      className={cn("cursor-pointer select-none outline-none", className)}
      {...props}
    >
      {!asChild ? children : undefined}
    </Menu.Trigger>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export interface DropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Popup> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  width?: string;
}

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(({ align = "end", side = "bottom", sideOffset = 4, className, children, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <Menu.Portal>
      <Menu.Positioner side={side} align={align} sideOffset={sideOffset} className="z-[1100]">
        <Menu.Popup
          ref={ref}
          className={cn(
            "min-w-36 p-1 bg-popover text-popover-foreground flex flex-col outline-none shadow-md transition-all",
            "data-open:animate-in data-open:fade-in data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out data-closed:zoom-out-95 duration-100",
            isPixelTheme
              ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
              : "border border-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]",
            className
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Item> {
  destructive?: boolean;
  closeOnClick?: boolean;
}

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  DropdownMenuItemProps
>(({ destructive = false, className, children, onClick, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <Menu.Item
      ref={ref}
      onClick={onClick}
      className={cn(
        "w-full text-left px-2.5 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-start gap-2 select-none outline-none data-disabled:opacity-50 data-disabled:pointer-events-none data-highlighted:bg-muted",
        isPixelTheme ? "rounded-xs font-mono" : "rounded-lg",
        destructive
          ? "text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
          : "text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Menu.Item>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Menu.Separator>
>(({ className, ...props }, ref) => {
  return (
    <Menu.Separator
      ref={ref}
      className={cn("h-px bg-border my-1 -mx-1", className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuLabel = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Menu.GroupLabel>
>(({ className, ...props }, ref) => {
  return (
    <Menu.GroupLabel
      ref={ref}
      className={cn("px-2 py-1 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuGroup = Menu.Group;

export const DropdownMenuSub = Menu.SubmenuRoot;

export interface DropdownMenuSubTriggerProps
  extends React.ComponentPropsWithoutRef<typeof Menu.SubmenuTrigger> {
  inset?: boolean;
}

export const DropdownMenuSubTrigger = forwardRef<
  HTMLDivElement,
  DropdownMenuSubTriggerProps
>(({ className, inset, children, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <Menu.SubmenuTrigger
      ref={ref}
      className={cn(
        "flex w-full cursor-pointer select-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs outline-none transition-colors data-open:bg-muted data-highlighted:bg-muted",
        inset && "pl-8",
        isPixelTheme ? "rounded-xs font-mono" : "rounded-lg",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">{children}</div>
      <ChevronRight size={13} className="text-muted-foreground ml-auto shrink-0 opacity-70" />
    </Menu.SubmenuTrigger>
  );
});
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export interface DropdownMenuSubContentProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Popup> {
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export const DropdownMenuSubContent = forwardRef<
  HTMLDivElement,
  DropdownMenuSubContentProps
>(({ className, sideOffset = 4, align = "start", ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={sideOffset} align={align} className="z-[1100]">
        <Menu.Popup
          ref={ref}
          className={cn(
            "min-w-36 p-1 bg-popover text-popover-foreground flex flex-col outline-none shadow-md transition-all",
            "data-open:animate-in data-open:fade-in data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out data-closed:zoom-out-95 duration-100",
            isPixelTheme
              ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
              : "border border-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]",
            className
          )}
          {...props}
        >
          {props.children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
});
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
