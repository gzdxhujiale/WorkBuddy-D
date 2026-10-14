import React, { useState } from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { clamp } from "./types";

export interface FocusTimeModalProps {
  focusMinutes: number;
  restMinutes: number;
  getThemeClasses: () => string;
  onSave: (focusMins: number, restMins: number) => void;
  onClose: () => void;
}

export const FocusTimeModal: React.FC<FocusTimeModalProps> = ({
  focusMinutes,
  restMinutes,
  getThemeClasses,
  onSave,
  onClose,
}) => {
  const [editFocusInput, setEditFocusInput] = useState<string>(String(focusMinutes));
  const [editRestInput, setEditRestInput] = useState<string>(String(restMinutes));

  const handleSave = () => {
    const fNum = clamp(Number(editFocusInput) || 25, 1, 180);
    const rNum = clamp(Number(editRestInput) || 5, 1, 60);
    onSave(fNum, rNum);
  };

  return (
    <div
      className={cn(
        "w-[200px] h-[180px] p-2.5 flex flex-col justify-between rounded-2xl select-none overflow-hidden text-xs border-0 outline-none",
        getThemeClasses()
      )}
    >
      <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700/80">
        <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
          <Clock size={13} className="text-orange-500" />
          <span>调整专注时长</span>
        </div>
        <button
          onClick={onClose}
          className="size-5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-2 py-1">
        {/* Focus minutes */}
        <div className="flex items-center justify-between">
          <label className="text-slate-600 dark:text-slate-300 text-xs">专注时长 (分)</label>
          <input
            type="number"
            min={1}
            max={180}
            value={editFocusInput}
            onChange={(e) => setEditFocusInput(e.target.value)}
            className="w-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
          />
        </div>

        {/* Rest minutes */}
        <div className="flex items-center justify-between">
          <label className="text-slate-600 dark:text-slate-300 text-xs">休息时长 (分)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={editRestInput}
            onChange={(e) => setEditRestInput(e.target.value)}
            className="w-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
        <button
          onClick={onClose}
          className="flex-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
        >
          保存并重置
        </button>
      </div>
    </div>
  );
};
