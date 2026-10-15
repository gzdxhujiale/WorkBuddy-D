import React, { useState, useRef, useCallback, forwardRef } from "react";
import { X } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export interface InputTagProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  saveOnBlur?: boolean;
  size?: "mini" | "small" | "default" | "large";
  className?: string;
  style?: React.CSSProperties;
}

export const InputTag = forwardRef<HTMLDivElement, InputTagProps>(
  (
    {
      value: controlledValue,
      defaultValue = [],
      onChange,
      placeholder = "输入标签后按回车...",
      disabled = false,
      allowClear = false,
      saveOnBlur = false,
      size = "mini",
      className,
      style,
    },
    ref
  ) => {
    const { isPixelTheme } = useAppThemeStyle();
    const [internalValue, setInternalValue] = useState<string[]>(
      controlledValue !== undefined ? controlledValue : defaultValue
    );
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const isControlled = controlledValue !== undefined;
    const tags = isControlled ? controlledValue || [] : internalValue;

    const commitTag = useCallback(
      (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        if (!tags.includes(trimmed)) {
          const next = [...tags, trimmed];
          if (!isControlled) {
            setInternalValue(next);
          }
          onChange?.(next);
        }
        setInputValue("");
      },
      [tags, isControlled, onChange]
    );

    const removeTag = useCallback(
      (index: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const next = tags.filter((_, i) => i !== index);
        if (!isControlled) {
          setInternalValue(next);
        }
        onChange?.(next);
      },
      [tags, isControlled, onChange]
    );

    const handleClearAll = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isControlled) {
          setInternalValue([]);
        }
        onChange?.([]);
      },
      [isControlled, onChange]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commitTag(inputValue);
      } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    };

    const handleBlur = () => {
      if (saveOnBlur && inputValue) {
        commitTag(inputValue);
      }
    };

    const isMini = size === "mini";

    return (
      <div
        ref={ref}
        style={style}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex flex-wrap items-center gap-1.5 px-2.5 transition-colors cursor-text min-h-[34px]",
          isMini && "min-h-[28px] py-0.5 px-2 text-xs",
          disabled && "opacity-50 cursor-not-allowed",
          isPixelTheme
            ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted text-foreground font-mono shadow-[1px_1px_0px_#000] focus-within:border-amber-600 focus-within:bg-background"
            : "bg-background/80 dark:bg-card/60 border border-border/70 rounded-md text-foreground hover:border-border focus-within:border-ring shadow-2xs",
          className
        )}
      >
        {/* Rendered tag pills */}
        {tags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className={cn(
              "inline-flex items-center gap-1 leading-none select-none",
              isPixelTheme
                ? "rounded-xs border-2 border-amber-900/60 bg-amber-100/80 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 text-[11px] font-mono shadow-[1px_1px_0px_#000]"
                : "rounded bg-secondary text-secondary-foreground px-2 py-0.5 text-[11px] font-medium",
              isMini && "text-[10px] py-0.5 px-1"
            )}
          >
            <span className="truncate max-w-[120px]">{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => removeTag(idx, e)}
                className="hover:opacity-70 p-0.5 rounded cursor-pointer shrink-0"
              >
                <X size={10} />
              </button>
            )}
          </span>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : ""}
          className={cn(
            "flex-1 min-w-[60px] bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground",
            isMini ? "text-xs h-6" : "text-sm h-7",
            isPixelTheme && "font-mono"
          )}
        />

        {/* Clear all button */}
        {allowClear && tags.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-muted-foreground hover:text-foreground p-0.5 ml-auto cursor-pointer"
            title="清空所有标签"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }
);

InputTag.displayName = "InputTag";

export type { InputTagProps as ArcoInputTagProps };
