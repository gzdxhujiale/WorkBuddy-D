import React from "react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  ariaLabel,
  className,
}) => {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 select-none",
        isPixelTheme
          ? cn(
              "h-6 w-11 rounded-xs border-2 border-amber-950 dark:border-amber-900 shadow-[1px_1px_0px_#000] cursor-pointer",
              checked ? "bg-amber-500" : "bg-[#4a3b2c]/30 dark:bg-[#2b1f14]"
            )
          : cn(
              "h-6 w-11 rounded-full cursor-pointer",
              checked ? "bg-primary" : "bg-muted-foreground/30"
            ),
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block transition-transform duration-150 ease-in-out",
          isPixelTheme
            ? cn(
                "size-4 rounded-xs bg-[#fffaf0] border border-amber-950 shadow-[1px_1px_0px_#000]",
                checked ? "translate-x-[20px]" : "translate-x-[2px]"
              )
            : cn(
                "size-5 rounded-full bg-white shadow-xs",
                checked ? "translate-x-5.5" : "translate-x-0.5"
              )
        )}
      />
    </button>
  );
};
