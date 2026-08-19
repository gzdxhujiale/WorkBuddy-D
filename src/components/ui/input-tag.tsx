import React from "react";
import { InputTag as ArcoInputTag } from "@arco-design/web-react";
import type { InputTagProps as ArcoInputTagProps } from "@arco-design/web-react";
import { cn } from "@/lib/utils";
import "@arco-design/web-react/dist/css/arco.css";

export interface InputTagProps extends ArcoInputTagProps {
  className?: string;
}

export const InputTag = React.forwardRef<any, InputTagProps>(
  ({ className, size = "mini", ...props }, ref) => {
    return (
      <ArcoInputTag
        ref={ref}
        size={size}
        className={cn(
          "!bg-background/80 dark:!bg-card/60 !border !border-border/70 !rounded-md !text-foreground hover:!border-border focus-within:!border-ring transition-colors shadow-2xs",
          "[&_.arco-input-tag-inner]:!bg-transparent",
          "[&_.arco-input-tag-tag]:!bg-secondary [&_.arco-input-tag-tag]:!text-secondary-foreground [&_.arco-input-tag-tag]:!rounded [&_.arco-input-tag-tag]:!border-0 [&_.arco-input-tag-tag]:!text-[11px] [&_.arco-input-tag-tag]:!font-medium",
          "[&_.arco-input-tag-input]:!text-foreground [&_.arco-input-tag-input]:!text-xs",
          className
        )}
        {...props}
      />
    );
  }
);

InputTag.displayName = "InputTag";

export type { ArcoInputTagProps };
