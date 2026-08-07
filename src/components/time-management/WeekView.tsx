import React, { useMemo } from "react";
import { Task, Role, QuadrantType } from "@/types/timeManagement";

interface WeekViewProps {
  currentDate: Date;
  tasks: Task[];
  roles?: Role[];
  onSelectDate: (date: Date) => void;
  onSelectTask: (task: Task, anchorEl?: HTMLElement) => void;
  onCreateTask: (quadrant?: QuadrantType, scheduledDate?: string) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 - 20:00
const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  tasks,
  roles = [],
  onSelectDate,
  onSelectTask,
  onCreateTask,
}) => {
  const weekDays = useMemo(() => {
    // 0 = Sun, 1 = Mon -> Map Monday as start (0)
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const formatDateYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getRoleColor = (roleId?: string) => {
    if (!roleId) return null;
    return roles.find((r) => r.id === roleId)?.color;
  };

  return (
    <div className="h-full min-h-[460px] flex flex-col bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-xs select-none overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1.5 min-w-[700px]">
          {/* Top-left empty corner */}
          <div className="h-12 border-b border-slate-200 dark:border-slate-800" />

          {/* Weekday headers */}
          {weekDays.map((dateObj, i) => {
            const isSelected =
              dateObj.getFullYear() === currentDate.getFullYear() &&
              dateObj.getMonth() === currentDate.getMonth() &&
              dateObj.getDate() === currentDate.getDate();

            const isToday =
              dateObj.toDateString() === new Date().toDateString();

            return (
              <button
                key={dateObj.toISOString()}
                onClick={() => onSelectDate(dateObj)}
                className={`h-12 text-center py-1.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-500/40 shadow-xs"
                    : isToday
                    ? "bg-blue-50/50 dark:bg-slate-800 text-blue-500 border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div>周{WEEKDAY_LABELS[i]}</div>
                <div className="font-mono text-[11px] font-bold">
                  {dateObj.getMonth() + 1}/{dateObj.getDate()}
                </div>
              </button>
            );
          })}

          {/* Hour Rows */}
          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              {/* Hour Label */}
              <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 py-2 pr-2 text-right border-r border-slate-200/60 dark:border-slate-800 shrink-0">
                {String(hour).padStart(2, "0")}:00
              </div>

              {/* 7 Columns for each hour slot */}
              {weekDays.map((dateObj) => {
                const dateStr = formatDateYMD(dateObj);

                // Filter tasks for this day & hour
                const cellTasks = tasks.filter((t) => {
                  if (t.deadline) {
                    const d = new Date(t.deadline);
                    return (
                      d.getFullYear() === dateObj.getFullYear() &&
                      d.getMonth() === dateObj.getMonth() &&
                      d.getDate() === dateObj.getDate() &&
                      d.getHours() === hour
                    );
                  }
                  if (t.scheduledDate === dateStr) {
                    // Default scheduledDate tasks without hour place in 09:00 slot
                    return hour === 9;
                  }
                  return false;
                });

                return (
                  <div
                    key={`${dateObj.toISOString()}-${hour}`}
                    onClick={() => {
                      if (cellTasks.length === 0) {
                        onCreateTask("Q2", dateStr);
                      }
                    }}
                    className="min-h-[48px] border border-slate-200/50 dark:border-slate-800/50 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 p-1 space-y-1 hover:border-blue-400/40 hover:bg-slate-100/50 dark:hover:bg-slate-850/50 transition-colors cursor-pointer group"
                  >
                    {cellTasks.length === 0 && (
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 dark:text-slate-500 px-1 transition-opacity">
                        + 新建
                      </span>
                    )}

                    {cellTasks.map((t) => {
                      const roleColor = getRoleColor(t.roleId);
                      return (
                        <div
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask(t, e.currentTarget);
                          }}
                          className={`w-full text-left px-1.5 py-1 rounded-lg text-[11px] border truncate transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-1 ${
                            t.completed
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800 line-through"
                              : t.quadrant === "Q1"
                              ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50"
                              : t.quadrant === "Q2"
                              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"
                              : t.quadrant === "Q3"
                              ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {roleColor && (
                            <span
                              className="size-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: roleColor }}
                            />
                          )}
                          <span className="truncate">{t.title}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
