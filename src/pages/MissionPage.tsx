import React from "react";
import { Navigation } from "lucide-react";

export const MissionPage: React.FC = () => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Navigation className="text-purple-600 dark:text-purple-400" size={26} />
          人生罗盘
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          锚定长期愿景、使命与终极愿景
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">🎯 核心愿景</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">定义你未来 3-5 年期望达到的生活与事业状态</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">🧭 价值观与原则</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">指导决策与日常行动的底层基准准则</p>
        </div>
      </div>
    </div>
  );
};
