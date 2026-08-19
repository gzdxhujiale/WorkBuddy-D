import * as React from "react";
import { createPortal } from "react-dom";
import dayjs, { Dayjs } from "dayjs";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type { Dayjs };
export type CalendarValue = string | number | Date | Dayjs;

export interface DateShortcut {
  text: React.ReactNode;
  value: () => CalendarValue;
}

export interface RangeShortcut {
  text: React.ReactNode;
  value: () => [CalendarValue, CalendarValue];
}

export interface TimePickerConfig {
  defaultValue?: string;
  format?: string;
}

export interface DatePickerProps {
  value?: CalendarValue | null;
  defaultValue?: CalendarValue | null;
  onChange?: (dateString: string, date: Dayjs | null) => void;
  onOk?: (dateString: string, date: Dayjs | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showTime?: boolean | TimePickerConfig;
  format?: string;
  shortcuts?: DateShortcut[];
  minDate?: CalendarValue;
  maxDate?: CalendarValue;
  disabledDate?: (current: Dayjs) => boolean;
  size?: "mini" | "small" | "default" | "large";
  className?: string;
  style?: React.CSSProperties;
}

export interface DateRangePickerProps {
  value?: [CalendarValue | null | undefined, CalendarValue | null | undefined] | null;
  defaultValue?: [CalendarValue | null | undefined, CalendarValue | null | undefined];
  onChange?: (dateStrings: string[], dates: (Dayjs | null)[]) => void;
  onOk?: (dateStrings: string[], dates: (Dayjs | null)[]) => void;
  placeholder?: [string, string];
  disabled?: boolean | [boolean, boolean];
  allowClear?: boolean;
  showTime?: boolean | { defaultValue?: [string, string]; format?: string };
  format?: string;
  shortcuts?: RangeShortcut[];
  minDate?: CalendarValue;
  maxDate?: CalendarValue;
  disabledDate?: (current: Dayjs) => boolean;
  size?: "mini" | "small" | "default" | "large";
  className?: string;
  style?: React.CSSProperties;
}

function toDayjs(val?: CalendarValue | null): Dayjs | null {
  if (!val) return null;
  const d = dayjs(val);
  return d.isValid() ? d : null;
}

interface TimeValue {
  hour: number;
  minute: number;
  second: number;
}

function parseTimeToObject(d?: Dayjs | null, fallback?: string): TimeValue {
  if (d && d.isValid()) {
    return {
      hour: d.hour(),
      minute: d.minute(),
      second: d.second(),
    };
  }
  if (fallback) {
    const parts = fallback.split(":").map((p) => parseInt(p, 10) || 0);
    return {
      hour: parts[0] || 0,
      minute: parts[1] || 0,
      second: parts[2] || 0,
    };
  }
  return { hour: 0, minute: 0, second: 0 };
}

function applyTimeToDate(d: Dayjs, time: TimeValue): Dayjs {
  return d.hour(time.hour).minute(time.minute).second(time.second);
}

// 星期列表（周一至周日）
const WEEKDAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

// 尺寸样式映射（紧凑精致）
const sizeClasses = {
  mini: "h-6.5 text-[11px] px-1.5 gap-1",
  small: "h-7.5 text-xs px-2 gap-1.5",
  default: "h-8.5 text-xs px-2.5 gap-1.5",
  large: "h-9.5 text-sm px-3 gap-2",
};

// 预设常用范围快捷选项
export const defaultRangeShortcuts: RangeShortcut[] = [
  { text: "今天", value: () => [dayjs(), dayjs()] },
  { text: "未来 7 天", value: () => [dayjs(), dayjs().add(6, "day")] },
  { text: "未来 30 天", value: () => [dayjs(), dayjs().add(29, "day")] },
  { text: "本月", value: () => [dayjs().startOf("month"), dayjs().endOf("month")] },
  { text: "下月", value: () => [dayjs().add(1, "month").startOf("month"), dayjs().add(1, "month").endOf("month")] },
];

export const defaultDateShortcuts: DateShortcut[] = [
  { text: "今天", value: () => dayjs() },
  { text: "明天", value: () => dayjs().add(1, "day") },
];

/**
 * 单个月份日历网格计算
 */
function useMonthDays(viewMonth: Dayjs) {
  return React.useMemo(() => {
    const startOfMonth = viewMonth.startOf("month");
    const daysInMonth = viewMonth.daysInMonth();
    const startDayOfWeek = (startOfMonth.day() + 6) % 7;

    const days: { date: Dayjs; isCurrentMonth: boolean }[] = [];

    // 上个月的补全天数
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: startOfMonth.subtract(i + 1, "day"),
        isCurrentMonth: false,
      });
    }

    // 当月天数
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: viewMonth.date(d),
        isCurrentMonth: true,
      });
    }

    // 下个月的补全天数（补齐到 35 或 42 格）
    const totalSlots = days.length > 35 ? 42 : 35;
    const remaining = totalSlots - days.length;
    const nextMonth = viewMonth.add(1, "month").startOf("month");
    for (let i = 0; i < remaining; i++) {
      days.push({
        date: nextMonth.date(i + 1),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewMonth]);
}

/**
 * 弹出层定位计算 Hook（支持自适应向上/向下翻转、靠右对其与屏幕边界吸附）
 */
function usePopoverPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  popoverRef: React.RefObject<HTMLElement | null>,
  defaultWidth = 440
) {
  const [pos, setPos] = React.useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  });

  const update = React.useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current?.getBoundingClientRect();

    const width = popoverRect?.width && popoverRect.width > 0 ? popoverRect.width : defaultWidth;
    const height = popoverRect?.height && popoverRect.height > 0 ? popoverRect.height : 280;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 垂直方向：默认向下弹出；若下方高度不足且上方空间更大，则向上弹出
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    let top = triggerRect.bottom + 4;

    if (spaceBelow < height + 8 && spaceAbove > spaceBelow) {
      top = Math.max(8, triggerRect.top - height - 4);
    }

    // 水平方向：默认左对齐；若超出屏幕右侧，则改为与触发器右对齐
    let left = triggerRect.left;
    if (left + width > viewportWidth - 8) {
      left = triggerRect.right - width;
    }

    // 屏幕边缘安全边距限制
    if (left + width > viewportWidth - 8) {
      left = viewportWidth - width - 8;
    }
    if (left < 8) {
      left = 8;
    }
    if (top < 8) {
      top = 8;
    }

    setPos({ top: Math.round(top), left: Math.round(left), ready: true });
  }, [triggerRef, popoverRef, defaultWidth]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPos((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }

    update();
    const raf = requestAnimationFrame(update);

    const handleScrollOrResize = () => update();
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [open, update]);

  return pos;
}

/**
 * 可滚动时间列（时/分/秒）
 */
interface TimeColumnProps {
  count: number;
  value: number;
  onChange: (val: number) => void;
  format?: (val: number) => string;
}

const TimeColumn = React.memo(function TimeColumn({
  count,
  value,
  onChange,
  format = (v) => String(v).padStart(2, "0"),
}: TimeColumnProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      const selectedEl = containerRef.current.children[value] as HTMLElement | undefined;
      if (selectedEl) {
        containerRef.current.scrollTop =
          selectedEl.offsetTop - containerRef.current.clientHeight / 2 + selectedEl.clientHeight / 2;
      }
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="flex-1 h-[210px] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col py-0.5 text-center select-none"
    >
      {Array.from({ length: count }, (_, i) => {
        const isSelected = i === value;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={cn(
              "h-6 shrink-0 flex items-center justify-center text-[11px] tabular-nums font-mono transition-colors rounded cursor-pointer mx-0.5 my-px",
              isSelected
                ? "bg-muted text-primary font-semibold"
                : "text-foreground/80 hover:bg-accent hover:text-foreground"
            )}
          >
            {format(i)}
          </button>
        );
      })}
    </div>
  );
});

/**
 * =========================================================================
 * 1. 单日期选择器组件 (DatePicker) - 支持时间切换、清除时间与确定确认
 * =========================================================================
 */
const DatePickerInternal = React.forwardRef<HTMLDivElement, DatePickerProps>(
  (
    {
      value: propValue,
      defaultValue,
      onChange,
      onOk,
      placeholder,
      disabled = false,
      allowClear = true,
      showTime = false,
      format,
      shortcuts = defaultDateShortcuts,
      minDate,
      maxDate,
      disabledDate: customDisabledDate,
      size = "default",
      className,
      style,
    },
    ref
  ) => {
    const { isPixelTheme } = useAppThemeStyle();
    const isControlled = propValue !== undefined;
    const [internalValue, setInternalValue] = React.useState<Dayjs | null>(() =>
      toDayjs(propValue ?? defaultValue)
    );
    const committedDate = React.useMemo(
      () => (isControlled ? toDayjs(propValue) : internalValue),
      [isControlled, propValue, internalValue]
    );

    const [open, setOpen] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<"date" | "time">("date");

    // 草稿日期与时刻
    const [draftDate, setDraftDate] = React.useState<Dayjs | null>(() => committedDate ?? dayjs());
    const [viewMonth, setViewMonth] = React.useState<Dayjs>(() => draftDate ?? dayjs());
    const [draftTime, setDraftTime] = React.useState<TimeValue>(() =>
      parseTimeToObject(committedDate, typeof showTime === "object" ? showTime.defaultValue : undefined)
    );

    const triggerRef = React.useRef<HTMLDivElement>(null);
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const popoverPos = usePopoverPosition(open, triggerRef, popoverRef, 230);

    const isTimeSet = (time: TimeValue) => time.hour !== 0 || time.minute !== 0 || time.second !== 0;
    const defaultPlaceholder = showTime ? "选择日期时间" : "选择日期";

    const getDisplayString = (d: Dayjs | null) => {
      if (!d) return placeholder ?? defaultPlaceholder;
      if (format) return d.format(format);
      if (d.hour() !== 0 || d.minute() !== 0 || d.second() !== 0 || showTime) {
        return d.format("YYYY-MM-DD HH:mm:ss");
      }
      return d.format("YYYY-MM-DD");
    };

    const prevOpenRef = React.useRef(false);

    // 仅在从关闭切换到打开时重置草稿状态，避免重复触发更新循环
    React.useEffect(() => {
      if (open && !prevOpenRef.current) {
        const base = committedDate ?? dayjs();
        setDraftDate(committedDate);
        setViewMonth(base);
        setDraftTime(
          parseTimeToObject(committedDate, typeof showTime === "object" ? showTime.defaultValue : undefined)
        );
        setViewMode("date");
      }
      prevOpenRef.current = open;
    }, [open, committedDate, showTime]);

    React.useEffect(() => {
      if (!open) return;
      const handleDocClick = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          popoverRef.current &&
          !popoverRef.current.contains(target) &&
          triggerRef.current &&
          !triggerRef.current.contains(target)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleDocClick);
      return () => document.removeEventListener("mousedown", handleDocClick);
    }, [open]);

    const isDateDisabled = React.useCallback(
      (current: Dayjs) => {
        if (customDisabledDate && customDisabledDate(current)) return true;
        if (minDate && current.isBefore(dayjs(minDate), "day")) return true;
        if (maxDate && current.isAfter(dayjs(maxDate), "day")) return true;
        return false;
      },
      [customDisabledDate, minDate, maxDate]
    );

    const monthDays = useMonthDays(viewMonth);

    const handleSelectDay = (day: Dayjs) => {
      setDraftDate(day);
    };

    const handleConfirm = () => {
      const base = draftDate ?? dayjs();
      const finalDate = applyTimeToDate(base, draftTime);

      if (!isControlled) setInternalValue(finalDate);
      const outputFormat = format ?? (isTimeSet(draftTime) || showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD");
      const str = finalDate.format(outputFormat);
      onChange?.(str, finalDate);
      onOk?.(str, finalDate);
      setOpen(false);
    };

    const handleClearTime = () => {
      setDraftTime({ hour: 0, minute: 0, second: 0 });
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isControlled) setInternalValue(null);
      setDraftDate(null);
      onChange?.("", null);
    };

    const handleShortcut = (shortcut: DateShortcut) => {
      const val = toDayjs(shortcut.value());
      if (val) {
        const finalVal = applyTimeToDate(val, draftTime);
        if (!isControlled) setInternalValue(finalVal);
        const outputFormat = format ?? (isTimeSet(draftTime) || showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD");
        const str = finalVal.format(outputFormat);
        onChange?.(str, finalVal);
        onOk?.(str, finalVal);
        setOpen(false);
      }
    };

    return (
      <div ref={ref} style={style} className={cn("relative inline-block w-full select-none", className)}>
        {/* Trigger Bar */}
        <div
          ref={triggerRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setOpen(!open)}
          className={cn(
            "w-full transition-colors duration-150 flex items-center justify-between cursor-pointer focus:outline-none",
            isPixelTheme
              ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted text-foreground font-mono shadow-[1px_1px_0px_#000] focus:border-amber-600 focus:bg-background"
              : "rounded border border-border bg-background text-foreground hover:border-primary",
            sizeClasses[size],
            disabled && "opacity-50 pointer-events-none cursor-not-allowed bg-muted/40",
            open && (isPixelTheme ? "border-amber-600 ring-1 ring-amber-600" : "border-primary ring-1 ring-primary")
          )}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            <CalendarIcon className="size-3 text-muted-foreground shrink-0" />
            <span className={cn("truncate", !committedDate && "text-muted-foreground")}>
              {getDisplayString(committedDate)}
            </span>
          </div>

          {allowClear && committedDate && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <X className="size-2.5" />
            </button>
          ) : (
            <ChevronRight className="size-3 text-muted-foreground rotate-90 shrink-0" />
          )}
        </div>

        {/* Dropdown Popover */}
        {open &&
          createPortal(
            <div
              ref={popoverRef}
              style={{
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
                visibility: popoverPos.ready ? "visible" : "hidden",
              }}
              className={cn(
                "fixed z-[2000] text-card-foreground p-2 animate-in fade-in zoom-in-95 duration-150 select-none w-[230px]",
                isPixelTheme
                  ? "rounded-xs border-2 border-border shadow-[4px_4px_0px_#000] bg-popover font-mono"
                  : "rounded border border-border shadow-xl bg-card"
              )}
            >
              {viewMode === "date" ? (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-border/80 text-xs">
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMonth(viewMonth.subtract(1, "year"))}
                        className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                        title="上一年"
                      >
                        <ChevronsLeft className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMonth(viewMonth.subtract(1, "month"))}
                        className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                        title="上个月"
                      >
                        <ChevronLeft className="size-3" />
                      </Button>
                    </div>

                    <span className="font-semibold text-foreground text-xs tracking-tight">
                      {viewMonth.format("YYYY年 M月")}
                    </span>

                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMonth(viewMonth.add(1, "month"))}
                        className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                        title="下个月"
                      >
                        <ChevronRight className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMonth(viewMonth.add(1, "year"))}
                        className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                        title="下一年"
                      >
                        <ChevronsRight className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Weekday Header */}
                  <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground font-normal mb-0.5">
                    {WEEKDAY_NAMES.map((w) => (
                      <div key={w} className="py-0.5">
                        {w}
                      </div>
                    ))}
                  </div>

                  {/* Day Grid */}
                  <div className="grid grid-cols-7 text-center">
                    {monthDays.map(({ date: d, isCurrentMonth }, idx) => {
                      const dStr = d.format("YYYY-MM-DD");
                      const isSelected = draftDate ? draftDate.format("YYYY-MM-DD") === dStr : false;
                      const isToday = dStr === dayjs().format("YYYY-MM-DD");
                      const isDisabled = isDateDisabled(d) || !isCurrentMonth;

                      return (
                        <div key={`${dStr}-${idx}`} className="h-6.5 flex items-center justify-center">
                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={() => !isDisabled && handleSelectDay(d)}
                            className={cn(
                              "size-6 text-[11px] font-normal transition-colors cursor-pointer relative flex items-center justify-center",
                              isPixelTheme ? "rounded-xs font-mono" : "rounded-full",
                              !isCurrentMonth && "text-muted-foreground/30 pointer-events-none cursor-default",
                              isCurrentMonth && !isSelected && "text-foreground hover:bg-accent",
                              isSelected && (isPixelTheme ? "bg-amber-500 text-amber-950 font-bold border border-amber-900 shadow-[1px_1px_0px_#000]" : "bg-primary text-primary-foreground font-medium"),
                              isDisabled && "opacity-20 pointer-events-none"
                            )}
                          >
                            {d.date()}
                            {isToday && !isSelected && (
                              <span className="absolute bottom-0.5 size-0.5 rounded-full bg-primary" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Time Mode */
                <div className="w-full flex flex-col">
                  <div className="text-center text-xs font-semibold py-1 mb-1 border-b border-border/80 text-foreground">
                    选择时间
                  </div>
                  <div className="flex divide-x divide-border/60">
                    <TimeColumn count={24} value={draftTime.hour} onChange={(hour) => setDraftTime({ ...draftTime, hour })} />
                    <TimeColumn count={60} value={draftTime.minute} onChange={(minute) => setDraftTime({ ...draftTime, minute })} />
                    <TimeColumn count={60} value={draftTime.second} onChange={(second) => setDraftTime({ ...draftTime, second })} />
                  </div>
                </div>
              )}

              {/* Bottom Footer */}
              <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between gap-1.5 px-0.5">
                <div className="flex items-center gap-1 min-w-0">
                  {viewMode === "time" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearTime}
                      className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                    >
                      清除时间
                    </Button>
                  ) : shortcuts && shortcuts.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {shortcuts.map((sc, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShortcut(sc)}
                          className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                        >
                          {sc.text}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {viewMode === "date" ? (
                    <button
                      type="button"
                      onClick={() => setViewMode("time")}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      选择时间
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setViewMode("date")}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      选择日期
                    </button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirm}
                    className="h-5.5 px-2.5 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded shadow-xs"
                  >
                    确定
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);
DatePickerInternal.displayName = "DatePicker";

/**
 * =========================================================================
 * 2. 日期范围选择器组件 (DateRangePicker) - 支持双时间段选择、清除时间与确定确认
 * =========================================================================
 */
export const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  (
    {
      value: propValue,
      defaultValue,
      onChange,
      onOk,
      placeholder = ["开始日期", "结束日期"],
      disabled = false,
      allowClear = true,
      showTime = false,
      format,
      shortcuts = defaultRangeShortcuts,
      minDate,
      maxDate,
      disabledDate: customDisabledDate,
      size = "default",
      className,
      style,
    },
    ref
  ) => {
    const { isPixelTheme } = useAppThemeStyle();
    const isControlled = propValue !== undefined;
    const [internalRange, setInternalRange] = React.useState<[Dayjs | null, Dayjs | null]>(() => {
      const initial = propValue ?? defaultValue;
      return initial ? [toDayjs(initial[0]), toDayjs(initial[1])] : [null, null];
    });

    const propStart = propValue?.[0];
    const propEnd = propValue?.[1];

    const committedStart = React.useMemo(() => {
      return isControlled ? toDayjs(propStart) : internalRange[0];
    }, [isControlled, propStart, internalRange]);

    const committedEnd = React.useMemo(() => {
      return isControlled ? toDayjs(propEnd) : internalRange[1];
    }, [isControlled, propEnd, internalRange]);

    const [open, setOpen] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<"date" | "time">("date");

    // 草稿日期与时刻
    const [draftStart, setDraftStart] = React.useState<Dayjs | null>(() => committedStart);
    const [draftEnd, setDraftEnd] = React.useState<Dayjs | null>(() => committedEnd);
    const [draftStartTime, setDraftStartTime] = React.useState<TimeValue>(() =>
      parseTimeToObject(committedStart, typeof showTime === "object" ? showTime.defaultValue?.[0] : undefined)
    );
    const [draftEndTime, setDraftEndTime] = React.useState<TimeValue>(() =>
      parseTimeToObject(committedEnd, typeof showTime === "object" ? showTime.defaultValue?.[1] : undefined)
    );

    const [selectingStart, setSelectingStart] = React.useState<Dayjs | null>(null);
    const [hoverDate, setHoverDate] = React.useState<Dayjs | null>(null);

    // 双月份视图状态
    const [leftMonth, setLeftMonth] = React.useState<Dayjs>(() => draftStart ?? dayjs());
    const rightMonth = React.useMemo(() => leftMonth.add(1, "month"), [leftMonth]);

    const triggerRef = React.useRef<HTMLDivElement>(null);
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const popoverPos = usePopoverPosition(open, triggerRef, popoverRef, 440);

    const isTimeSet = (time: TimeValue) => time.hour !== 0 || time.minute !== 0 || time.second !== 0;

    const getDisplayString = (d: Dayjs | null, fallbackPlaceholder: string) => {
      if (!d) return fallbackPlaceholder;
      if (format) return d.format(format);
      if (d.hour() !== 0 || d.minute() !== 0 || d.second() !== 0 || showTime) {
        return d.format("YYYY-MM-DD HH:mm:ss");
      }
      return d.format("YYYY-MM-DD");
    };

    const prevOpenRef = React.useRef(false);

    // 仅在从关闭切换到打开时重置草稿状态，避免切换面板时重复触发更新死循环
    React.useEffect(() => {
      if (open && !prevOpenRef.current) {
        setDraftStart(committedStart);
        setDraftEnd(committedEnd);
        setDraftStartTime(
          parseTimeToObject(committedStart, typeof showTime === "object" ? showTime.defaultValue?.[0] : undefined)
        );
        setDraftEndTime(
          parseTimeToObject(committedEnd, typeof showTime === "object" ? showTime.defaultValue?.[1] : undefined)
        );
        if (committedStart) setLeftMonth(committedStart);
        setViewMode("date");
        setSelectingStart(null);
        setHoverDate(null);
      }
      prevOpenRef.current = open;
    }, [open, committedStart, committedEnd, showTime]);

    React.useEffect(() => {
      if (!open) return;
      const handleDocClick = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          popoverRef.current &&
          !popoverRef.current.contains(target) &&
          triggerRef.current &&
          !triggerRef.current.contains(target)
        ) {
          setOpen(false);
          setSelectingStart(null);
          setHoverDate(null);
        }
      };
      document.addEventListener("mousedown", handleDocClick);
      return () => document.removeEventListener("mousedown", handleDocClick);
    }, [open]);

    const isDateDisabled = React.useCallback(
      (current: Dayjs) => {
        if (customDisabledDate && customDisabledDate(current)) return true;
        if (minDate && current.isBefore(dayjs(minDate), "day")) return true;
        if (maxDate && current.isAfter(dayjs(maxDate), "day")) return true;
        return false;
      },
      [customDisabledDate, minDate, maxDate]
    );

    const leftDays = useMonthDays(leftMonth);
    const rightDays = useMonthDays(rightMonth);

    const handleCellClick = (d: Dayjs) => {
      if (!selectingStart) {
        setSelectingStart(d);
        setDraftStart(d);
        setDraftEnd(null);
        setHoverDate(null);
      } else {
        let s = selectingStart;
        let e = d;
        if (e.isBefore(s, "day")) {
          [s, e] = [e, s];
        }
        setDraftStart(s);
        setDraftEnd(e);
        setSelectingStart(null);
        setHoverDate(null);
      }
    };

    const handleConfirm = () => {
      let s = draftStart ?? dayjs();
      let e = draftEnd ?? draftStart ?? dayjs();

      s = applyTimeToDate(s, draftStartTime);
      e = applyTimeToDate(e, draftEndTime);

      if (e.isBefore(s)) {
        [s, e] = [e, s];
      }

      if (!isControlled) {
        setInternalRange([s, e]);
      }

      const outputFormat = format ?? (isTimeSet(draftStartTime) || isTimeSet(draftEndTime) || showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD");
      const strList = [s.format(outputFormat), e.format(outputFormat)];
      onChange?.(strList, [s, e]);
      onOk?.(strList, [s, e]);
      setOpen(false);
      setSelectingStart(null);
      setHoverDate(null);
    };

    const handleClearTime = () => {
      setDraftStartTime({ hour: 0, minute: 0, second: 0 });
      setDraftEndTime({ hour: 0, minute: 0, second: 0 });
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isControlled) setInternalRange([null, null]);
      setDraftStart(null);
      setDraftEnd(null);
      setSelectingStart(null);
      setHoverDate(null);
      onChange?.(["", ""], [null, null]);
    };

    const handleShortcut = (shortcut: RangeShortcut) => {
      const [sVal, eVal] = shortcut.value();
      let s = toDayjs(sVal);
      let e = toDayjs(eVal);
      if (s && e) {
        s = applyTimeToDate(s, draftStartTime);
        e = applyTimeToDate(e, draftEndTime);
        if (!isControlled) setInternalRange([s, e]);
        const outputFormat = format ?? (isTimeSet(draftStartTime) || isTimeSet(draftEndTime) || showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD");
        const strList = [s.format(outputFormat), e.format(outputFormat)];
        onChange?.(strList, [s, e]);
        onOk?.(strList, [s, e]);
        setOpen(false);
        setSelectingStart(null);
        setHoverDate(null);
      }
    };

    // 活跃范围计算（含 Hover 预览）
    const effectiveStart = selectingStart ?? draftStart;
    const effectiveEnd = selectingStart ? (hoverDate ?? selectingStart) : draftEnd;
    const rangeStart =
      effectiveStart && effectiveEnd && effectiveEnd.isBefore(effectiveStart, "day")
        ? effectiveEnd
        : effectiveStart;
    const rangeEnd =
      effectiveStart && effectiveEnd && effectiveEnd.isBefore(effectiveStart, "day")
        ? effectiveStart
        : effectiveEnd;

    // 单个单元格状态计算（Arco 直角纯方块逻辑）
    const getCellStatus = (d: Dayjs, isCurrentMonth: boolean) => {
      if (!isCurrentMonth) {
        return { isStartDay: false, isEndDay: false, isSingle: false, inRange: false };
      }

      const dStr = d.format("YYYY-MM-DD");
      const isStartDay = rangeStart ? rangeStart.format("YYYY-MM-DD") === dStr : false;
      const isEndDay = rangeEnd ? rangeEnd.format("YYYY-MM-DD") === dStr : false;
      const isSingle = isStartDay && isEndDay;
      const inRange =
        rangeStart && rangeEnd && d.isAfter(rangeStart, "day") && d.isBefore(rangeEnd, "day");

      return { isStartDay, isEndDay, isSingle, inRange };
    };

    // 渲染单个日历面板（左或右，紧凑版）
    const renderMonthGrid = (
      month: Dayjs,
      days: { date: Dayjs; isCurrentMonth: boolean }[]
    ) => (
      <div className="w-[205px]">
        {/* Weekday Row */}
        <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground font-normal mb-0.5">
          {WEEKDAY_NAMES.map((w) => (
            <div key={w} className="py-0.5">
              {w}
            </div>
          ))}
        </div>

        {/* Day Grid - Arco 直角方块样式 */}
        <div className="grid grid-cols-7 text-center">
          {days.map(({ date: d, isCurrentMonth }, idx) => {
            const { isStartDay, isEndDay, isSingle, inRange } = getCellStatus(d, isCurrentMonth);
            const dStr = d.format("YYYY-MM-DD");
            const isToday = isCurrentMonth && dStr === dayjs().format("YYYY-MM-DD");
            const isDisabled = isDateDisabled(d) || !isCurrentMonth;

            const hasRangeBg = isCurrentMonth && inRange;

            return (
              <div
                key={`${month.format("YYYY-MM")}-${dStr}-${idx}`}
                onMouseEnter={() => isCurrentMonth && selectingStart && setHoverDate(d)}
                className={cn(
                  "h-6.5 flex items-center justify-center relative",
                  // Arco 直角纯色块背景
                  hasRangeBg && (isPixelTheme ? "bg-amber-100/60 dark:bg-amber-950/40" : "bg-[#e8f3ff] dark:bg-primary/20"),
                  isCurrentMonth && isStartDay && !isSingle && rangeEnd && (isPixelTheme ? "before:absolute before:right-0 before:top-0 before:bottom-0 before:w-1/2 before:bg-amber-100/60 dark:before:bg-amber-950/40" : "before:absolute before:right-0 before:top-0 before:bottom-0 before:w-1/2 before:bg-[#e8f3ff] dark:before:bg-primary/20"),
                  isCurrentMonth && isEndDay && !isSingle && rangeStart && (isPixelTheme ? "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1/2 before:bg-amber-100/60 dark:before:bg-amber-950/40" : "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1/2 before:bg-[#e8f3ff] dark:before:bg-primary/20")
                )}
              >
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => isCurrentMonth && !isDisabled && handleCellClick(d)}
                  className={cn(
                    "size-6 text-[11px] font-normal transition-colors cursor-pointer relative flex items-center justify-center z-10",
                    isPixelTheme ? "rounded-xs font-mono" : "rounded-full",
                    !isCurrentMonth && "text-muted-foreground/30 pointer-events-none cursor-default",
                    isCurrentMonth && !isStartDay && !isEndDay && !inRange && "text-foreground hover:bg-accent",
                    isCurrentMonth && inRange && "text-foreground font-medium",
                    isCurrentMonth && (isStartDay || isEndDay) && (isPixelTheme ? "bg-amber-500 text-amber-950 font-bold border border-amber-900 shadow-[1px_1px_0px_#000]" : "bg-primary text-primary-foreground font-medium"),
                    isDisabled && "opacity-20 pointer-events-none"
                  )}
                >
                  {d.date()}
                  {isToday && !isStartDay && !isEndDay && (
                    <span className="absolute bottom-0.5 size-0.5 rounded-full bg-primary" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div ref={ref} style={style} className={cn("relative inline-block w-full select-none", className)}>
        {/* Trigger Bar */}
        <div
          ref={triggerRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setOpen(!open)}
          className={cn(
            "w-full transition-colors duration-150 flex items-center justify-between cursor-pointer focus:outline-none",
            isPixelTheme
              ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted text-foreground font-mono shadow-[1px_1px_0px_#000] focus:border-amber-600 focus:bg-background"
              : "rounded border border-border bg-background text-foreground hover:border-primary",
            sizeClasses[size],
            disabled && "opacity-50 pointer-events-none cursor-not-allowed bg-muted/40",
            open && (isPixelTheme ? "border-amber-600 ring-1 ring-amber-600" : "border-primary ring-1 ring-primary")
          )}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            <CalendarIcon className="size-3 text-muted-foreground shrink-0" />
            <span className={cn("truncate", !committedStart && "text-muted-foreground")}>
              {getDisplayString(committedStart, placeholder[0])}
            </span>
            <span className="text-muted-foreground/60 shrink-0 text-[10px]">至</span>
            <span className={cn("truncate", !committedEnd && "text-muted-foreground")}>
              {getDisplayString(committedEnd, placeholder[1])}
            </span>
          </div>

          {allowClear && (committedStart || committedEnd) && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <X className="size-2.5" />
            </button>
          ) : (
            <ChevronRight className="size-3 text-muted-foreground rotate-90 shrink-0" />
          )}
        </div>

        {/* Dual Month Calendar Popover - 紧凑 Arco 风格 */}
        {open &&
          createPortal(
            <div
              ref={popoverRef}
              style={{
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
                visibility: popoverPos.ready ? "visible" : "hidden",
              }}
              className={cn(
                "fixed z-[2000] text-card-foreground p-2.5 animate-in fade-in zoom-in-95 duration-150 select-none w-[440px]",
                isPixelTheme
                  ? "rounded-xs border-2 border-border shadow-[4px_4px_0px_#000] bg-popover font-mono"
                  : "rounded border border-border shadow-xl bg-card"
              )}
            >
              {viewMode === "date" ? (
                <>
                  {/* Arco 统一双月份顶部操作栏 */}
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/80 text-xs px-0.5">
                    {/* 左月标题与翻页 */}
                    <div className="flex items-center justify-between w-[205px]">
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLeftMonth(leftMonth.subtract(1, "year"))}
                          className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                          title="上一年"
                        >
                          <ChevronsLeft className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLeftMonth(leftMonth.subtract(1, "month"))}
                          className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                          title="上个月"
                        >
                          <ChevronLeft className="size-3" />
                        </Button>
                      </div>

                      <span className="font-semibold text-foreground text-xs tracking-tight">
                        {leftMonth.format("YYYY年 M月")}
                      </span>

                      <div className="size-5" />
                    </div>

                    {/* 右月标题与翻页 */}
                    <div className="flex items-center justify-between w-[205px]">
                      <div className="size-5" />

                      <span className="font-semibold text-foreground text-xs tracking-tight">
                        {rightMonth.format("YYYY年 M月")}
                      </span>

                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLeftMonth(leftMonth.add(1, "month"))}
                          className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                          title="下个月"
                        >
                          <ChevronRight className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLeftMonth(leftMonth.add(1, "year"))}
                          className="size-5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                          title="下一年"
                        >
                          <ChevronsRight className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Dual month grids */}
                  <div className="flex items-start justify-between">
                    {renderMonthGrid(leftMonth, leftDays)}
                    <div className="w-[1px] bg-border/60 self-stretch my-0.5 mx-1" />
                    {renderMonthGrid(rightMonth, rightDays)}
                  </div>
                </>
              ) : (
                /* Time Mode: 左右两侧时分秒选择面板（完全匹配 Arco 官方原生双时间段） */
                <div className="flex items-start justify-between w-full">
                  {/* 开始时间 */}
                  <div className="w-[205px] flex flex-col">
                    <div className="text-center text-xs font-semibold py-1 mb-1 border-b border-border/80 text-foreground">
                      选择时间
                    </div>
                    <div className="flex divide-x divide-border/60">
                      <TimeColumn
                        count={24}
                        value={draftStartTime.hour}
                        onChange={(hour) => setDraftStartTime({ ...draftStartTime, hour })}
                      />
                      <TimeColumn
                        count={60}
                        value={draftStartTime.minute}
                        onChange={(minute) => setDraftStartTime({ ...draftStartTime, minute })}
                      />
                      <TimeColumn
                        count={60}
                        value={draftStartTime.second}
                        onChange={(second) => setDraftStartTime({ ...draftStartTime, second })}
                      />
                    </div>
                  </div>

                  <div className="w-[1px] bg-border/60 self-stretch my-0.5 mx-1" />

                  {/* 结束时间 */}
                  <div className="w-[205px] flex flex-col">
                    <div className="text-center text-xs font-semibold py-1 mb-1 border-b border-border/80 text-foreground">
                      选择时间
                    </div>
                    <div className="flex divide-x divide-border/60">
                      <TimeColumn
                        count={24}
                        value={draftEndTime.hour}
                        onChange={(hour) => setDraftEndTime({ ...draftEndTime, hour })}
                      />
                      <TimeColumn
                        count={60}
                        value={draftEndTime.minute}
                        onChange={(minute) => setDraftEndTime({ ...draftEndTime, minute })}
                      />
                      <TimeColumn
                        count={60}
                        value={draftEndTime.second}
                        onChange={(second) => setDraftEndTime({ ...draftEndTime, second })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Footer */}
              <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between gap-1.5 px-0.5">
                <div className="flex items-center gap-1 min-w-0">
                  {viewMode === "time" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearTime}
                      className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                    >
                      清除时间
                    </Button>
                  ) : shortcuts && shortcuts.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {shortcuts.map((sc, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShortcut(sc)}
                          className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                        >
                          {sc.text}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {viewMode === "date" ? (
                    <button
                      type="button"
                      onClick={() => setViewMode("time")}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      选择时间
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setViewMode("date")}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      选择日期
                    </button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirm}
                    className="h-5.5 px-2.5 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded shadow-xs"
                  >
                    确定
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);
DateRangePicker.displayName = "DateRangePicker";

export const RangePicker = DateRangePicker;

export type DatePickerComponent = typeof DatePickerInternal & {
  RangePicker: typeof DateRangePicker;
};

export const DatePicker = DatePickerInternal as DatePickerComponent;
DatePicker.RangePicker = DateRangePicker;

export default DatePicker;
