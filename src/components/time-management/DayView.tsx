import React from "react";
import { Task, Role, QuadrantType } from "@/types/timeManagement";
import { CheckCircle2, Circle, Clock, Plus, Tag } from "lucide-react";
import { getTaskEndAt, getTaskStartAt, taskIntersectsDay, taskTimeLabel } from "@/lib/taskSchedule";

interface DayViewProps {
  currentDate: Date;
  tasks: Task[];
  roles?: Role[];
  onToggleComplete: (taskId: string) => void;
  onSelectTask: (task: Task, anchorEl?: HTMLElement) => void;
  onCreateTask: (quadrant?: QuadrantType, initialDate?: string) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 - 20:00

const QUADRANT_LABELS: Record<QuadrantType, { label: string; badge: string }> = {
  Q1: { label: "Q1 重要且紧急", badge: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
  Q2: { label: "Q2 重要不紧急", badge: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  Q3: { label: "Q3 紧急不重要", badge: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  Q4: { label: "Q4 不重要不紧急", badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" },
};

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  tasks,
  roles = [],
  onToggleComplete,
  onSelectTask,
  onCreateTask,
}) => {
  const formatDateYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const currentDateStr = formatDateYMD(currentDate);

  const dayTasks = tasks.filter((task) => taskIntersectsDay(task, currentDate));

  const taskDisplayHour = (task: Task): number | undefined => {
    const end = getTaskEndAt(task);
    if (!end) return undefined;
    if (task.scheduleMode !== "range") return new Date(end).getHours();

    const dayStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    ).getTime();
    const start = getTaskStartAt(task) ?? dayStart;
    return new Date(Math.max(start, dayStart + 8 * 60 * 60 * 1000)).getHours();
  };

  const getRole = (roleId?: string) => {
    if (!roleId) return null;
    return roles.find((r) => r.id === roleId);
  };

  return (
    <div className="h-full min-h-[460px] flex flex-col bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-xs select-none overflow-hidden">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <Clock size={14} className="text-blue-500" />
          <span>{currentDate.getMonth() + 1}月{currentDate.getDate()}日 · 当日时间轴表</span>
        </div>
        <button
          onClick={() => onCreateTask("Q2", currentDateStr)}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={14} />
          <span>新建任务</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {HOURS.map((hour) => {
          const hourSlotTasks = dayTasks.filter((t) => {
            return taskDisplayHour(t) === hour;
          });

          return (
            <div
              key={hour}
              className="grid grid-cols-[60px_1fr] gap-3 items-stretch min-h-[56px]"
            >
              {/* Hour time label */}
              <div className="text-xs font-mono text-slate-400 dark:text-slate-500 pt-2.5 text-right font-medium">
                {String(hour).padStart(2, "0")}:00
              </div>

              {/* Hour Slot Container */}
              <div
                onClick={() => {
                  if (hourSlotTasks.length === 0) {
                    onCreateTask("Q2", currentDateStr);
                  }
                }}
                className="rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 p-2 text-left hover:border-blue-400/40 transition-colors min-h-[56px] flex flex-col gap-1.5 justify-center group cursor-pointer"
              >
                {hourSlotTasks.length === 0 ? (
                  <span className="text-xs text-slate-400 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pl-1">
                    + 点击在 {String(hour).padStart(2, "0")}:00 创建任务
                  </span>
                ) : (
                  hourSlotTasks.map((t) => {
                    const role = getRole(t.roleId);
                    const quadInfo = QUADRANT_LABELS[t.quadrant];

                    return (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTask(t, e.currentTarget);
                        }}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          t.completed
                            ? "bg-slate-100/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 opacity-70"
                            : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 shadow-2xs hover:border-blue-400/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(t.id);
                            }}
                            className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0 cursor-pointer"
                          >
                            {t.completed ? (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                              <Circle size={16} />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div
                              className={`text-xs font-semibold leading-snug truncate ${
                                t.completed
                                  ? "line-through text-slate-400 dark:text-slate-500"
                                  : "text-slate-800 dark:text-slate-200"
                              }`}
                            >
                             {t.title}
                            </div>

                            {t.scheduleMode === "range" && (
                              <div className="text-[10px] text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">
                                时间段 · {taskTimeLabel(t)}
                              </div>
                            )}

                            {t.description && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {t.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {role && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white shadow-2xs"
                              style={{ backgroundColor: role.color || "#3b82f6" }}
                            >
                              <Tag size={10} />
                              {role.name}
                            </span>
                          )}

                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${quadInfo.badge}`}
                          >
                            {t.quadrant}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
