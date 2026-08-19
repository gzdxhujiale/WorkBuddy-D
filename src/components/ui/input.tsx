import * as React from "react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const { isPixelTheme } = useAppThemeStyle();

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full px-3.5 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          isPixelTheme
            ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus-visible:border-amber-600 focus-visible:bg-background font-mono shadow-[1px_1px_0px_#000]"
            : "rounded-lg border border-input bg-background/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 backdrop-blur-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
