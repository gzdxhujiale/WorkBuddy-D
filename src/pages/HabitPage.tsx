import React from "react";
import { Flame } from "lucide-react";

export const HabitPage: React.FC = () => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Flame className="text-orange-600 dark:text-orange-400" size={26} />
          习惯追踪
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          打卡打磨微小习惯，打造成长的复利基石
        </p>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <Flame size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
        <p className="text-sm text-slate-500 dark:text-slate-400">尚未创建习惯卡片，开启你的打卡习惯吧！</p>
      </div>
    </div>
  );
};
