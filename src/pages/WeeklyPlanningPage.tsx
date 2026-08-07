import React from "react";
import { CalendarDays } from "lucide-react";

export const WeeklyPlanningPage: React.FC = () => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CalendarDays className="text-teal-600 dark:text-teal-400" size={26} />
          周计划
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          制定本周核心战术目标，把控周进度
        </p>
      </header>

      <div className="grid grid-cols-7 gap-3">
        {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => (
          <div
            key={day}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 min-h-[220px] flex flex-col"
          >
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
              {day}
            </div>
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">暂无任务</div>
          </div>
        ))}
      </div>
    </div>
  );
};
