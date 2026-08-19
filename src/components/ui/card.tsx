import * as React from "react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <div
      ref={ref}
      className={cn(
        isPixelTheme
          ? "rounded-xs border-2 border-border bg-card text-card-foreground shadow-[3px_3px_0px_#000] font-mono"
          : "rounded-xl border border-border bg-card text-card-foreground shadow-xs",
        className
      )}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <h3
      ref={ref}
      className={cn(
        "font-bold text-sm leading-none tracking-tight text-foreground",
        isPixelTheme && "font-mono",
        className
      )}
      {...props}
    />
  );
});
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <p
      ref={ref}
      className={cn(
        "text-xs text-muted-foreground",
        isPixelTheme && "font-mono",
        className
      )}
      {...props}
    />
  );
});
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isPixelTheme } = useAppThemeStyle();
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center p-4 pt-0",
        isPixelTheme && "font-mono",
        className
      )}
      {...props}
    />
  );
});
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
