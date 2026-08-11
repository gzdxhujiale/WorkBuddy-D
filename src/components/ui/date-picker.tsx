import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "选择日期",
  className,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    return value ? dayjs(value) : dayjs();
  });

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

  React.useEffect(() => {
    if (value) {
      setCurrentMonth(dayjs(value));
    }
  }, [value]);

  // Dynamically calculate popover position on screen
  const updatePosition = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 288;
      const popoverHeight = 320;

      let top = rect.bottom + 6;
      let left = rect.left;

      if (top + popoverHeight > window.innerHeight) {
        top = Math.max(10, rect.top - popoverHeight - 6);
      }

      if (left + popoverWidth > window.innerWidth) {
        left = Math.max(10, window.innerWidth - popoverWidth - 10);
      }

      setPopoverPos({ top, left });
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [open, updatePosition]);

  // Handle outside click to close
  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedDate = value ? dayjs(value) : null;
  const daysInMonth = currentMonth.daysInMonth();
  const startOfMonth = currentMonth.startOf("month");
  const startDayOfWeek = (startOfMonth.day() + 6) % 7; // Monday-based: 0 is Mon, 6 is Sun

  const days: (dayjs.Dayjs | null)[] = React.useMemo(() => {
    const list: (dayjs.Dayjs | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      list.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(currentMonth.date(d));
    }
    return list;
  }, [startDayOfWeek, daysInMonth, currentMonth]);

  const handleSelectDate = (dStr: string) => {
    onChange(dStr);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="relative inline-block w-full select-none">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full h-10 px-3 rounded-lg border border-input bg-background text-sm flex items-center justify-between transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer select-none",
          !value && "text-muted-foreground",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate">{selectedDate ? selectedDate.format("YYYY年MM月DD日") : placeholder}</span>
        </div>
        {value ? (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-3.5" />
          </span>
        ) : (
          <ChevronRight className="size-4 text-muted-foreground rotate-90 shrink-0" />
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
            className="fixed z-[100] w-72 bg-card text-card-foreground rounded-2xl border border-border shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200 select-none"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(currentMonth.subtract(1, "month"))}
                className="size-7 p-0 cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-bold text-foreground">
                {currentMonth.format("YYYY年 MM月")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(currentMonth.add(1, "month"))}
                className="size-7 p-0 cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground font-semibold mb-1">
              {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                <div key={w} className="py-1">{w}</div>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {days.map((d, idx) => {
                if (!d) return <div key={`empty-${idx}`} className="h-8" />;
                const dStr = d.format("YYYY-MM-DD");
                const isSelected = value === dStr;
                const isToday = dStr === dayjs().format("YYYY-MM-DD");
                const isDisabled =
                  Boolean(minDate && dStr < minDate) || Boolean(maxDate && dStr > maxDate);

                return (
                  <button
                    key={dStr}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleSelectDate(dStr)}
                    className={cn(
                      "h-8 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center border border-transparent",
                      isDisabled && "opacity-30 pointer-events-none",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : isToday
                        ? "border-primary text-primary font-bold hover:bg-accent"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    {d.date()}
                  </button>
                );
              })}
            </div>

            {/* Today Button */}
            <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectDate(dayjs().format("YYYY-MM-DD"))}
                className="text-xs text-primary hover:bg-primary/10 cursor-pointer h-7 px-2"
              >
                选择今天
              </Button>
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectDate("")}
                  className="text-xs text-muted-foreground hover:bg-accent cursor-pointer h-7 px-2"
                >
                  清空
                </Button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
