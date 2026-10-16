import React, { createContext, useContext, forwardRef } from "react";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
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
}

export function DropdownMenu({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  children,
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
      <RadixDropdownMenu.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
      >
        {children}
      </RadixDropdownMenu.Root>
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Trigger> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Trigger>,
  DropdownMenuTriggerProps
>(({ className, ...props }, ref) => {
  return (
    <RadixDropdownMenu.Trigger
      ref={ref}
      className={cn("cursor-pointer select-none outline-none", className)}
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export interface DropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  width?: string;
}

export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Content>,
  DropdownMenuContentProps
>(({ align = "end", sideOffset = 4, className, children, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-[1100] min-w-36 p-1 bg-popover text-popover-foreground flex flex-col animate-in fade-in zoom-in-95 duration-100 outline-none",
          isPixelTheme
            ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
            : "border border-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]",
          className
        )}
        {...props}
      >
        {children}
      </RadixDropdownMenu.Content>
    </RadixDropdownMenu.Portal>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item> {
  destructive?: boolean;
  closeOnClick?: boolean;
}

export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Item>,
  DropdownMenuItemProps
>(({ destructive = false, className, children, onSelect, onClick, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <RadixDropdownMenu.Item
      ref={ref}
      onSelect={(e) => {
        onSelect?.(e);
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
      }}
      className={cn(
        "w-full text-left px-2.5 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-start gap-2 select-none outline-none data-[disabled]:opacity-50 data-[disabled]:pointer-events-none data-[highlighted]:bg-muted",
        isPixelTheme ? "rounded-xs font-mono" : "rounded-lg",
        destructive
          ? "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
          : "text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </RadixDropdownMenu.Item>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>
>(({ className, ...props }, ref) => {
  return (
    <RadixDropdownMenu.Separator
      ref={ref}
      className={cn("h-px bg-border my-1 -mx-1", className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuLabel = forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>
>(({ className, ...props }, ref) => {
  return (
    <RadixDropdownMenu.Label
      ref={ref}
      className={cn("px-2 py-1 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuGroup = RadixDropdownMenu.Group;

export const DropdownMenuSub = RadixDropdownMenu.Sub;

export interface DropdownMenuSubTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubTrigger> {
  inset?: boolean;
}

export const DropdownMenuSubTrigger = forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubTrigger>,
  DropdownMenuSubTriggerProps
>(({ className, inset, children, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <RadixDropdownMenu.SubTrigger
      ref={ref}
      className={cn(
        "flex w-full cursor-pointer select-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs outline-none transition-colors data-[state=open]:bg-muted data-[highlighted]:bg-muted",
        inset && "pl-8",
        isPixelTheme ? "rounded-xs font-mono" : "rounded-lg",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">{children}</div>
      <ChevronRight size={13} className="text-muted-foreground ml-auto shrink-0 opacity-70" />
    </RadixDropdownMenu.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export interface DropdownMenuSubContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubContent> {
  sideOffset?: number;
}

export const DropdownMenuSubContent = forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubContent>,
  DropdownMenuSubContentProps
>(({ className, sideOffset = 4, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.SubContent
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-[1100] min-w-36 p-1 bg-popover text-popover-foreground flex flex-col animate-in fade-in zoom-in-95 duration-100 outline-none",
          isPixelTheme
            ? "rounded-xs border-2 border-border font-mono shadow-[3px_3px_0px_#000]"
            : "border border-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]",
          className
        )}
        {...props}
      />
    </RadixDropdownMenu.Portal>
  );
});
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
