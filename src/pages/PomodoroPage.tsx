import React from "react";
import { Timer, Play } from "lucide-react";

export const PomodoroPage: React.FC = () => {
  return (
    <div className="p-6 h-full flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
        <Timer size={32} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">番茄专注</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-8 max-w-sm">
        保持 25 分钟沉浸式高效工作，随后休息 5 分钟
      </p>

      <div className="text-6xl font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-8">
        25:00
      </div>

      <button
        type="button"
        className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-base font-semibold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
      >
        <Play size={18} fill="currentColor" />
        开始专注
      </button>
    </div>
  );
};
