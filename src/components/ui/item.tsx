import * as React from "react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "ghost";
}

const Item = React.forwardRef<HTMLDivElement, ItemProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const { isPixelTheme } = useAppThemeStyle();

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between p-4 transition-all duration-200 select-none",
          isPixelTheme ? "rounded-xs font-mono" : "rounded-2xl",
          variant === "default" &&
            (isPixelTheme
              ? "bg-card text-card-foreground border-2 border-border shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]"
              : "bg-card text-card-foreground border border-border shadow-2xs hover:border-border/80 hover:shadow-xs"),
          variant === "outline" &&
            (isPixelTheme
              ? "border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-[1px_1px_0px_#000]"
              : "border border-border bg-background hover:bg-accent hover:text-accent-foreground"),
          variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
          className
        )}
        {...props}
      />
    );
  }
);
Item.displayName = "Item";

const ItemAvatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-center shrink-0", className)}
    {...props}
  />
));
ItemAvatar.displayName = "ItemAvatar";

const ItemContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1 min-w-0 flex-1", className)}
    {...props}
  />
));
ItemContent.displayName = "ItemContent";

const ItemTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <h3
      ref={ref}
      className={cn(
        "font-bold text-foreground text-base leading-snug truncate",
        isPixelTheme && "font-mono",
        className
      )}
      {...props}
    />
  );
});
ItemTitle.displayName = "ItemTitle";

const ItemDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <p
      ref={ref}
      className={cn(
        "text-xs text-muted-foreground font-medium truncate flex items-center gap-2",
        isPixelTheme && "font-mono",
        className
      )}
      {...props}
    />
  );
});
ItemDescription.displayName = "ItemDescription";

const ItemActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 shrink-0", className)}
    {...props}
  />
));
ItemActions.displayName = "ItemActions";

export {
  Item,
  ItemAvatar,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
};
