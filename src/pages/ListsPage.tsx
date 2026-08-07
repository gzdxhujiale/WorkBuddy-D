import React from "react";
import { ClipboardList } from "lucide-react";

export const ListsPage: React.FC = () => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ClipboardList className="text-cyan-600 dark:text-cyan-400" size={26} />
          清单
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          灵感收集箱与各类分类知识/任务清单
        </p>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <ClipboardList size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
        <p className="text-sm text-slate-500 dark:text-slate-400">灵感与清单收集箱为空</p>
      </div>
    </div>
  );
};
