import React, {
  useState,
  useMemo,
  useCallback,
  forwardRef,
} from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check, X } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

const EMPTY_VALUE_SENTINEL = "__EMPTY_SELECT_VALUE__";

export interface SelectOptionProps {
  value: any;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  [key: string]: any;
}

export const Option: React.FC<SelectOptionProps> = ({ children }) => {
  return <>{children}</>;
};

export const OptGroup: React.FC<{ label?: React.ReactNode; children?: React.ReactNode }> = ({
  label,
  children,
}) => {
  return (
    <RadixSelect.Group>
      {label && (
        <RadixSelect.Label className="px-2 py-1 text-xs font-semibold text-muted-foreground">
          {label}
        </RadixSelect.Label>
      )}
      {children}
    </RadixSelect.Group>
  );
};

export interface SelectItem {
  value: any;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value?: any;
  defaultValue?: any;
  onChange?: (value: any, option?: any) => void;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  allowClear?: boolean;
  options?: Array<SelectItem | string | number | { label: string; value: any; disabled?: boolean }>;
  children?: React.ReactNode;
  className?: string;
  dropdownMenuClassName?: string;
  style?: React.CSSProperties;
  size?: "mini" | "small" | "default" | "large";
  triggerProps?: any;
  getPopupContainer?: (node: HTMLElement) => HTMLElement;
}

const SelectComponent = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onChange,
      placeholder = "请选择",
      disabled = false,
      allowClear = false,
      options,
      children,
      className,
      dropdownMenuClassName,
      style,
    },
    ref
  ) => {
    const { isPixelTheme } = useAppThemeStyle();
    const [internalValue, setInternalValue] = useState<string | undefined>(() => {
      const init = controlledValue !== undefined ? controlledValue : defaultValue;
      if (init === "") return EMPTY_VALUE_SENTINEL;
      return init !== undefined ? String(init) : undefined;
    });

    const isControlled = controlledValue !== undefined;
    const rawValue = isControlled ? controlledValue : internalValue;
    const currentRadixValue =
      rawValue === ""
        ? EMPTY_VALUE_SENTINEL
        : rawValue !== undefined && rawValue !== null
        ? String(rawValue)
        : undefined;

    // Parse items from options prop or Select.Option children
    const parsedItems: SelectItem[] = useMemo(() => {
      if (options && options.length > 0) {
        return options.map((opt) => {
          if (typeof opt === "object" && opt !== null && "value" in opt) {
            return {
              value: opt.value,
              label: (opt as SelectItem).label ?? String(opt.value),
              disabled: (opt as SelectItem).disabled,
            };
          }
          return {
            value: opt,
            label: String(opt),
          };
        });
      }

      const items: SelectItem[] = [];
      React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        const childProps = (child as React.ReactElement<any>).props;
        if (childProps && childProps.value !== undefined) {
          items.push({
            value: childProps.value,
            label: childProps.children ?? String(childProps.value),
            disabled: childProps.disabled,
          });
        }
      });
      return items;
    }, [options, children]);

    const selectedItem = useMemo(() => {
      return parsedItems.find((item) => {
        if (currentRadixValue === EMPTY_VALUE_SENTINEL) {
          return item.value === "" || item.value === null;
        }
        return String(item.value) === String(currentRadixValue);
      });
    }, [parsedItems, currentRadixValue]);

    const handleValueChange = useCallback(
      (newRadixValue: string) => {
        const actualValue = newRadixValue === EMPTY_VALUE_SENTINEL ? "" : newRadixValue;
        const found = parsedItems.find((item) => {
          if (actualValue === "") return item.value === "" || item.value === null;
          return String(item.value) === actualValue;
        });

        const returnedValue = found ? found.value : actualValue;
        if (!isControlled) {
          setInternalValue(newRadixValue);
        }
        onChange?.(returnedValue, found);
      },
      [isControlled, onChange, parsedItems]
    );

    const handleClear = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!isControlled) {
          setInternalValue(undefined);
        }
        onChange?.("", undefined);
      },
      [isControlled, onChange]
    );

    return (
      <RadixSelect.Root
        value={currentRadixValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          ref={ref}
          style={style}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-1.5 min-h-[34px] text-sm text-left select-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none",
            isPixelTheme
              ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted text-foreground font-mono shadow-[1px_1px_0px_#000] focus:border-amber-600 focus:bg-background"
              : "rounded-lg border border-border/80 bg-background hover:border-primary/60 focus:border-primary text-foreground shadow-2xs",
            className
          )}
        >
          <span className="truncate flex-1 text-left">
            {selectedItem ? (
              selectedItem.label
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>

          <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
            {allowClear && selectedItem && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                className="hover:text-foreground p-0.5 rounded cursor-pointer"
                title="清除"
              >
                <X size={13} />
              </span>
            )}
            <RadixSelect.Icon asChild>
              <ChevronDown size={14} className="transition-transform duration-200" />
            </RadixSelect.Icon>
          </div>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-[1100] min-w-[var(--radix-select-trigger-width)] max-h-60 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-100",
              isPixelTheme
                ? "rounded-xs border-2 border-border bg-popover text-popover-foreground font-mono shadow-[3px_3px_0px_#000]"
                : "rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
              dropdownMenuClassName
            )}
          >
            <RadixSelect.Viewport className="p-0.5">
              {parsedItems.length === 0 ? (
                <div className="py-2 text-center text-xs text-muted-foreground">无匹配选项</div>
              ) : (
                parsedItems.map((item, index) => {
                  const itemRadixValue =
                    item.value === "" || item.value === null
                      ? EMPTY_VALUE_SENTINEL
                      : String(item.value);
                  const isSelected =
                    currentRadixValue === itemRadixValue ||
                    (currentRadixValue === EMPTY_VALUE_SENTINEL && item.value === "");

                  return (
                    <RadixSelect.Item
                      key={itemRadixValue || index}
                      value={itemRadixValue}
                      disabled={item.disabled}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 text-sm cursor-pointer select-none outline-none transition-colors",
                        item.disabled
                          ? "opacity-40 cursor-not-allowed"
                          : isPixelTheme
                          ? cn(
                              "rounded-xs hover:bg-muted font-mono data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
                              isSelected &&
                                "bg-amber-100 dark:bg-amber-950/80 font-bold text-amber-950 dark:text-amber-100"
                            )
                          : cn(
                              "rounded-md hover:bg-muted data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
                              isSelected && "bg-accent text-accent-foreground font-medium"
                            )
                      )}
                    >
                      <RadixSelect.ItemText>{item.label}</RadixSelect.ItemText>
                      <RadixSelect.ItemIndicator>
                        <Check size={14} className="shrink-0 ml-1 text-primary" />
                      </RadixSelect.ItemIndicator>
                    </RadixSelect.Item>
                  );
                })
              )}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    );
  }
);

SelectComponent.displayName = "Select";

export const Select = Object.assign(SelectComponent, {
  Option,
  OptGroup,
});

export type { SelectProps as ArcoSelectProps };
