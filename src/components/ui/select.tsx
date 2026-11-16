import React, {
  useState,
  useMemo,
  useCallback,
  forwardRef,
} from "react";
import { Select as BaseSelect } from "@base-ui-components/react/select";
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
    <BaseSelect.Group>
      {label && (
        <BaseSelect.GroupLabel className="px-2 py-1 text-xs font-semibold text-muted-foreground">
          {label}
        </BaseSelect.GroupLabel>
      )}
      {children}
    </BaseSelect.Group>
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
    const currentBaseValue =
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
        if (currentBaseValue === EMPTY_VALUE_SENTINEL) {
          return item.value === "" || item.value === null;
        }
        return String(item.value) === String(currentBaseValue);
      });
    }, [parsedItems, currentBaseValue]);

    const handleValueChange = useCallback(
      (newBaseValue: any) => {
        const valStr = String(newBaseValue ?? "");
        const actualValue = valStr === EMPTY_VALUE_SENTINEL ? "" : valStr;
        const found = parsedItems.find((item) => {
          if (actualValue === "") return item.value === "" || item.value === null;
          return String(item.value) === actualValue;
        });

        const returnedValue = found ? found.value : actualValue;
        if (!isControlled) {
          setInternalValue(valStr);
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
      <BaseSelect.Root
        value={currentBaseValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <BaseSelect.Trigger
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
            <BaseSelect.Icon>
              <ChevronDown size={14} className="transition-transform duration-200" />
            </BaseSelect.Icon>
          </div>
        </BaseSelect.Trigger>

        <BaseSelect.Portal>
          <BaseSelect.Positioner sideOffset={4} className="z-[1100]">
            <BaseSelect.Popup
              className={cn(
                "min-w-(--anchor-width) max-h-60 overflow-y-auto p-1 shadow-md transition-all outline-none",
                "data-open:animate-in data-open:fade-in data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out data-closed:zoom-out-95 duration-100",
                isPixelTheme
                  ? "rounded-xs border-2 border-border bg-popover text-popover-foreground font-mono shadow-[3px_3px_0px_#000]"
                  : "rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
                dropdownMenuClassName
              )}
            >
              <BaseSelect.List className="p-0.5">
                {parsedItems.length === 0 ? (
                  <div className="py-2 text-center text-xs text-muted-foreground">无匹配选项</div>
                ) : (
                  parsedItems.map((item, index) => {
                    const itemBaseValue =
                      item.value === "" || item.value === null
                        ? EMPTY_VALUE_SENTINEL
                        : String(item.value);
                    const isSelected =
                      currentBaseValue === itemBaseValue ||
                      (currentBaseValue === EMPTY_VALUE_SENTINEL && item.value === "");

                    return (
                      <BaseSelect.Item
                        key={itemBaseValue || index}
                        value={itemBaseValue}
                        disabled={item.disabled}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 text-sm cursor-pointer select-none outline-none transition-colors",
                          item.disabled
                            ? "opacity-40 cursor-not-allowed"
                            : isPixelTheme
                            ? cn(
                                "rounded-xs hover:bg-muted font-mono data-highlighted:bg-muted data-highlighted:text-foreground",
                                isSelected &&
                                  "bg-amber-100 dark:bg-amber-950/80 font-bold text-amber-950 dark:text-amber-100"
                              )
                            : cn(
                                "rounded-md hover:bg-muted data-highlighted:bg-muted data-highlighted:text-foreground",
                                isSelected && "bg-accent text-accent-foreground font-medium"
                              )
                        )}
                      >
                        <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                        <BaseSelect.ItemIndicator>
                          <Check size={14} className="shrink-0 ml-1 text-primary" />
                        </BaseSelect.ItemIndicator>
                      </BaseSelect.Item>
                    );
                  })
                )}
              </BaseSelect.List>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    );
  }
);

SelectComponent.displayName = "Select";

export const Select = Object.assign(SelectComponent, {
  Option,
  OptGroup,
});

export type { SelectProps as ArcoSelectProps };
