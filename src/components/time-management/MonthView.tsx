import React from "react";
import { Task, Role, QuadrantType } from "@/types/timeManagement";

interface MonthViewProps {
  currentDate: Date;
  tasks: Task[];
  roles?: Role[];
  onSelectDay: (date: Date) => void;
  onSelectTask: (task: Task, anchorEl?: HTMLElement) => void;
  onCreateTask?: (quadrant?: QuadrantType, scheduledDate?: string) => void;
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  tasks,
  roles = [],
  onSelectDay,
  onSelectTask,
}) => {
  const now = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const selectedDay = currentDate.getDate();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Calculate day of week for the 1st day of month (0 = Sunday, 1 = Monday...) -> map to Monday start (0 = Mon, 6 = Sun)
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getRoleColor = (roleId?: string) => {
    if (!roleId) return null;
    return roles.find((r) => r.id === roleId)?.color;
  };

  return (
    <div className="h-full min-h-[460px] flex flex-col bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-xs select-none">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={d} className={i >= 5 ? "text-blue-600 dark:text-blue-400" : ""}>
            {`周${d}`}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr min-h-0 pt-2">
        {cells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <div key={`empty-${idx}`} className="rounded-xl bg-transparent" />;
          }

          const isSelected = dayNum === selectedDay;
          const isToday =
            dayNum === now.getDate() &&
            month === now.getMonth() &&
            year === now.getFullYear();

          const cellDate = new Date(year, month, dayNum);

          // Match tasks for this day
          const dayTasks = tasks.filter((t) => {
            if (t.deadline) {
              const d = new Date(t.deadline);
              return (
                d.getFullYear() === year &&
                d.getMonth() === month &&
                d.getDate() === dayNum
              );
            }
            if (t.scheduledDate) {
              const [y, m, day] = t.scheduledDate.split("-").map(Number);
              return y === year && m === month + 1 && day === dayNum;
            }
            return false;
          });

          return (
            <div
              key={dayNum}
              onClick={() => onSelectDay(cellDate)}
              className={`min-h-[80px] rounded-xl p-2 border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                isSelected
                  ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/60 shadow-xs ring-1 ring-blue-500/30"
                  : "bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400/50 hover:bg-slate-50 dark:hover:bg-slate-850"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-xs font-bold ${
                    isToday
                      ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded-full"
                      : isSelected
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {dayNum}
                </span>
                {isToday && (
                  <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                {dayTasks.slice(0, 3).map((t) => {
                  const roleColor = getRoleColor(t.roleId);
                  return (
                    <div
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask(t, e.currentTarget);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[11px] truncate border flex items-center gap-1 transition-all hover:scale-[1.02] cursor-pointer ${
                        t.completed
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800 line-through"
                          : t.quadrant === "Q1"
                          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50"
                          : t.quadrant === "Q2"
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"
                          : t.quadrant === "Q3"
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50"
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
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-slate-400 font-medium pl-1">
                    +{dayTasks.length - 3} 项
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
