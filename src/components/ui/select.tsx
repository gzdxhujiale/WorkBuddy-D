import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
} from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

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
    <div>
      {label && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{label}</div>}
      {children}
    </div>
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
  options?: Array<SelectItem | string | number>;
  children?: React.ReactNode;
  className?: string;
  dropdownMenuClassName?: string;
  style?: React.CSSProperties;
  size?: "mini" | "small" | "default" | "large";
  triggerProps?: any;
  getPopupContainer?: (node: HTMLElement) => HTMLElement;
}

const SelectComponent = forwardRef<HTMLDivElement, SelectProps>(
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
    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(
      controlledValue !== undefined ? controlledValue : defaultValue
    );
    const containerRef = useRef<HTMLDivElement>(null);

    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled ? controlledValue : internalValue;

    // Parse options from props.options or props.children
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
      return parsedItems.find((item) => String(item.value) === String(currentValue));
    }, [parsedItems, currentValue]);

    // Close dropdown on click outside
    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const handleSelect = useCallback(
      (item: SelectItem) => {
        if (item.disabled) return;
        if (!isControlled) {
          setInternalValue(item.value);
        }
        onChange?.(item.value, item);
        setIsOpen(false);
      },
      [isControlled, onChange]
    );

    const handleClear = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isControlled) {
          setInternalValue("");
        }
        onChange?.("", undefined);
      },
      [isControlled, onChange]
    );

    return (
      <div
        ref={(node) => {
          (containerRef as any).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as any).current = node;
        }}
        style={style}
        className={cn("relative inline-block text-left text-sm select-none", className)}
      >
        {/* Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-1.5 min-h-[34px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            isPixelTheme
              ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted text-foreground font-mono shadow-[1px_1px_0px_#000] focus:border-amber-600 focus:bg-background"
              : "rounded-lg border border-border/80 bg-background hover:border-primary/60 focus:border-primary text-foreground shadow-2xs"
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
            {allowClear && selectedItem && (
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
            <ChevronDown
              size={14}
              className={cn("transition-transform duration-200", isOpen && "rotate-180")}
            />
          </div>
        </button>

        {/* Dropdown Menu Popover */}
        {isOpen && (
          <div
            className={cn(
              "absolute left-0 top-full mt-1 w-full min-w-[120px] max-h-60 overflow-y-auto z-50 p-1 animate-in fade-in zoom-in-95 duration-100",
              isPixelTheme
                ? "rounded-xs border-2 border-border bg-popover text-popover-foreground font-mono shadow-[3px_3px_0px_#000]"
                : "rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
              dropdownMenuClassName
            )}
          >
            {parsedItems.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">无匹配选项</div>
            ) : (
              parsedItems.map((item, index) => {
                const isSelected = String(item.value) === String(currentValue);
                return (
                  <div
                    key={String(item.value) || index}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 text-sm cursor-pointer transition-colors",
                      item.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : isPixelTheme
                        ? cn(
                            "rounded-xs hover:bg-muted font-mono",
                            isSelected &&
                              "bg-amber-100 dark:bg-amber-950/80 font-bold text-amber-950 dark:text-amber-100"
                          )
                        : cn(
                            "rounded-md hover:bg-muted",
                            isSelected && "bg-accent text-accent-foreground font-medium"
                          )
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected && <Check size={14} className="shrink-0 ml-1 text-primary" />}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }
);

SelectComponent.displayName = "Select";

export const Select = Object.assign(SelectComponent, {
  Option,
  OptGroup,
});

export type { SelectProps as ArcoSelectProps };
