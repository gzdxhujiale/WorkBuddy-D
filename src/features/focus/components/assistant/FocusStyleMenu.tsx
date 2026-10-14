import React from "react";
import {
  Clock,
  Sparkles,
  ChevronRight,
  Volume2,
  VolumeX,
  RotateCcw,
  Sun,
  Gamepad2,
  Cat,
  Dog,
  Bot,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StyleTheme } from "./types";

export interface FocusStyleMenuProps {
  activeModal: "menu" | "style-menu";
  theme: StyleTheme;
  focusMinutes: number;
  restMinutes: number;
  isPinned: boolean;
  soundOn: boolean;
  showStats: boolean;
  isPurePet: boolean;
  getThemeClasses: () => string;
  onOpenTimeEditor: () => void;
  onOpenStyleMenu: () => void;
  onTogglePin: () => void;
  onToggleSound: () => void;
  onToggleStats: () => void;
  onResetTimer: () => void;
  onSetTheme: (theme: StyleTheme) => void;
  onClose: () => void;
}

export const FocusStyleMenu: React.FC<FocusStyleMenuProps> = ({
  activeModal,
  theme,
  focusMinutes,
  restMinutes,
  isPinned,
  soundOn,
  showStats,
  isPurePet,
  getThemeClasses,
  onOpenTimeEditor,
  onOpenStyleMenu,
  onTogglePin,
  onToggleSound,
  onToggleStats,
  onResetTimer,
  onSetTheme,
  onClose,
}) => {
  return (
    <div
      className={cn(
        "w-[200px] h-[250px] p-2.5 flex flex-col justify-between rounded-2xl select-none overflow-hidden text-xs border-0 outline-none",
        getThemeClasses()
      )}
    >
      <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700/80">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {activeModal === "style-menu" ? "选择主题风格" : "专注助手选项"}
        </span>
        <button
          onClick={onClose}
          className="size-5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      {activeModal === "menu" ? (
        <div className="flex-1 py-1 space-y-1 overflow-y-auto no-scrollbar text-xs">
          {/* Modify Time Settings */}
          <button
            onClick={onOpenTimeEditor}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-orange-500" />
              <span>修改时间设置 ({focusMinutes}分/{restMinutes}分)</span>
            </div>
            <ChevronRight size={12} className="text-slate-400" />
          </button>

          {/* Switch Style */}
          <button
            onClick={onOpenStyleMenu}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-blue-500" />
              <span>切换主题风格</span>
            </div>
            <ChevronRight size={12} className="text-slate-400" />
          </button>

          {/* Toggle Always on Top */}
          <button
            onClick={onTogglePin}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <span>窗口置顶</span>
            <span className="text-[11px] text-slate-400 font-medium">
              {isPinned ? "已开启" : "已关闭"}
            </span>
          </button>

          {/* Toggle Sound Effects */}
          <button
            onClick={onToggleSound}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              {soundOn ? (
                <Volume2 size={13} className="text-emerald-500" />
              ) : (
                <VolumeX size={13} className="text-slate-400" />
              )}
              <span>提示音效</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {soundOn ? "已开启" : "已静音"}
            </span>
          </button>

          {/* Toggle Stats expansion (in card modes) */}
          {!isPurePet && (
            <button
              onClick={onToggleStats}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <span>统计详情面板</span>
              <span className="text-[11px] text-slate-400 font-medium">
                {showStats ? "折叠" : "展开"}
              </span>
            </button>
          )}

          {/* Reset Timer */}
          <button
            onClick={onResetTimer}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <span>重置倒计时</span>
            <RotateCcw size={12} className="text-slate-400" />
          </button>
        </div>
      ) : (
        <div className="flex-1 py-1 space-y-1 overflow-y-auto no-scrollbar text-xs">
          {/* 1. Classic Light */}
          <button
            onClick={() => onSetTheme("classic")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
              theme === "classic" && "bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
            )}
          >
            <div className="flex items-center gap-2">
              <Sun size={13} className="text-amber-500" />
              <span>经典浅色卡片</span>
            </div>
            {theme === "classic" && <Check size={13} className="text-blue-500" />}
          </button>

          {/* 2. Retro Pixel Cat Card */}
          <button
            onClick={() => onSetTheme("pixel")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
              theme === "pixel" && "bg-amber-100/80 text-amber-900 font-medium"
            )}
          >
            <div className="flex items-center gap-2">
              <Gamepad2 size={13} className="text-orange-600" />
              <span>复古像素猫 (卡片)</span>
            </div>
            {theme === "pixel" && <Check size={13} className="text-amber-700" />}
          </button>

          {/* 3. Retro Pixel Cat Pure Pet */}
          <button
            onClick={() => onSetTheme("pixel-pure")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
              theme === "pixel-pure" && "bg-amber-200/80 text-amber-950 font-bold"
            )}
          >
            <div className="flex items-center gap-2">
              <Cat size={13} className="text-orange-600" />
              <span>复古像素猫 (纯宠物)</span>
            </div>
            {theme === "pixel-pure" && <Check size={13} className="text-amber-900" />}
          </button>

          {/* 4. Retro Pixel Dog Card */}
          <button
            onClick={() => onSetTheme("pixel-dog")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
              theme === "pixel-dog" && "bg-amber-100/80 text-amber-900 font-medium"
            )}
          >
            <div className="flex items-center gap-2">
              <Gamepad2 size={13} className="text-amber-700" />
              <span>复古像素狗 (卡片)</span>
            </div>
            {theme === "pixel-dog" && <Check size={13} className="text-amber-700" />}
          </button>

          {/* 5. Retro Pixel Dog Pure Pet */}
          <button
            onClick={() => onSetTheme("pixel-dog-pure")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
              theme === "pixel-dog-pure" && "bg-amber-200/80 text-amber-950 font-bold"
            )}
          >
            <div className="flex items-center gap-2">
              <Dog size={13} className="text-amber-700" />
              <span>复古像素狗 (纯宠物)</span>
            </div>
            {theme === "pixel-dog-pure" && <Check size={13} className="text-amber-900" />}
          </button>

          {/* 6. Modern Vector Dog Card */}
          <button
            onClick={() => onSetTheme("vector")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
              theme === "vector" && "bg-orange-100/80 text-orange-900 font-medium"
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-orange-500" />
              <span>现代矢量柴犬 (卡片)</span>
            </div>
            {theme === "vector" && <Check size={13} className="text-orange-600" />}
          </button>

          {/* 7. Modern Vector Dog Pure Pet */}
          <button
            onClick={() => onSetTheme("vector-pure")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
              theme === "vector-pure" && "bg-orange-200/80 text-orange-950 font-bold"
            )}
          >
            <div className="flex items-center gap-2">
              <Bot size={13} className="text-orange-600" />
              <span>现代矢量柴犬 (纯宠物)</span>
            </div>
            {theme === "vector-pure" && <Check size={13} className="text-orange-700" />}
          </button>
        </div>
      )}

      <div className="pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
        <button
          onClick={onClose}
          className="w-full py-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium cursor-pointer"
        >
          返回
        </button>
      </div>
    </div>
  );
};
