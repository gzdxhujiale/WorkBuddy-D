import React from "react";
import { CalendarCheck, Plus, CheckCircle2 } from "lucide-react";

export const TodayPage: React.FC = () => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarCheck className="text-blue-600 dark:text-blue-400" size={26} />
            当日待办
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            专注今天最重要的事项，保持高效推进
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={16} />
          新建任务
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">总任务数</div>
          <div className="text-2xl font-semibold mt-2 text-slate-900 dark:text-slate-100">0</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">已完成</div>
          <div className="text-2xl font-semibold mt-2 text-emerald-600 dark:text-emerald-400">0</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">进行中</div>
          <div className="text-2xl font-semibold mt-2 text-amber-600 dark:text-amber-400">0</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center">
        <CheckCircle2 size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">暂无今日待办事项</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
          点击右上角“新建任务”开始规划今天的行动清单吧！
        </p>
      </div>
    </div>
  );
};
