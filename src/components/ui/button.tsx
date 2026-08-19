import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-8 w-8 p-0 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size, ...props }, ref) => {
    const { isPixelTheme } = useAppThemeStyle();

    const pixelStyle = isPixelTheme
      ? cn(
          "rounded-xs font-mono active:scale-100",
          variant !== "link" && variant !== "ghost" && "border-2 border-border shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none",
          variant === "ghost" && "hover:border hover:border-border hover:shadow-[1px_1px_0px_#000]",
          variant === "default" && "bg-amber-500 text-amber-950 font-bold border-amber-900 hover:bg-amber-400 dark:bg-amber-500 dark:text-amber-950",
          variant === "destructive" && "bg-red-600 text-white font-bold border-red-950 hover:bg-red-500",
          variant === "outline" && "border-2 border-border bg-muted/60 hover:bg-muted font-medium text-foreground",
          variant === "secondary" && "border-2 border-border bg-secondary text-secondary-foreground font-medium"
        )
      : "";

    return (
      <button
        className={cn(buttonVariants({ variant, size }), pixelStyle, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
