import React from "react";
import {
  Play,
  Pause,
  X,
  MoreHorizontal,
  ChevronRight,
  RotateCcw,
  Coffee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FocusSessionType } from "../../types";
import type { FocusStats } from "../../api/focusAssistantService";
import type { PetState } from "../pets/PixelPet";
import { SpeechBubble } from "../pets/SpeechBubble";
import { FocusPetDisplay } from "./FocusPetDisplay";
import {
  formatTime,
  getTargetLabel,
  getThemeClasses,
  SelectedTarget,
  Status,
  StyleTheme,
} from "./types";

export interface FocusTimerControlsProps {
  theme: StyleTheme;
  status: Status;
  sessionType: FocusSessionType;
  secondsLeft: number;
  plannedMinutes: number;
  selectedTarget: SelectedTarget;
  stats: FocusStats;
  showStats: boolean;
  isGlowActive: boolean;
  bubbleText: string | null;
  petState: PetState;
  isDragging: boolean;
  dragDirection: "left" | "right";
  isPetPoked: boolean;
  onPokePet: () => void;
  onDismissBubble: () => void;
  onToggleStats: () => void;
  onOpenMenu: () => void;
  onCloseWindow: () => void;
  onOpenTaskSelector: () => void;
  onOpenTimeEditor: () => void;
  onStartFocus: () => void;
  onPause: () => void;
  onResume: () => void;
  onStopFocusAndStartRest: () => void;
  onSkipRest: () => void;
}

export const FocusTimerControls: React.FC<FocusTimerControlsProps> = ({
  theme,
  status,
  sessionType,
  secondsLeft,
  plannedMinutes,
  selectedTarget,
  stats,
  showStats,
  isGlowActive,
  bubbleText,
  petState,
  isDragging,
  dragDirection,
  isPetPoked,
  onPokePet,
  onDismissBubble,
  onToggleStats,
  onOpenMenu,
  onCloseWindow,
  onOpenTaskSelector,
  onOpenTimeEditor,
  onStartFocus,
  onPause,
  onResume,
  onStopFocusAndStartRest,
  onSkipRest,
}) => {
  const totalSeconds = plannedMinutes * 60;
  const progressRatio = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const strokeDashoffset = 113.1 * (1 - progressRatio); // 2 * PI * 18 ≈ 113.1

  return (
    <div
      className={cn(
        "relative w-[185px] rounded-2xl select-none transition-all duration-300 flex flex-col justify-between overflow-visible outline-none shrink-0",
        showStats ? "h-[135px] p-2.5" : "h-[70px] px-2.5 py-1.5",
        isGlowActive &&
          (theme.startsWith("pixel")
            ? "shadow-[0px_0px_0px_3px_#F59E0B,0px_0px_16px_rgba(245,158,11,0.6)]"
            : "ring-4 ring-amber-400/70 dark:ring-amber-500/70 shadow-[0_0_24px_rgba(245,158,11,0.55)] animate-pulse"),
        getThemeClasses(theme)
      )}
    >
      {/* Speech Bubble floating overlay inside card */}
      {bubbleText && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[185px]">
          <SpeechBubble text={bubbleText} theme={theme} onDismiss={onDismissBubble} />
        </div>
      )}

      {/* Top Right: Window Actions (Stats, Menu, Close) */}
      <div className="absolute top-1.5 right-2 flex items-center gap-0.5 text-slate-400 dark:text-slate-500 z-20">
        {/* Toggle Stats */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStats();
          }}
          className={cn(
            "p-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer rounded",
            showStats && "text-blue-500 dark:text-blue-400"
          )}
          title={showStats ? "收起统计" : "展开今日/本周统计"}
        >
          <RotateCcw size={12} className={cn("transition-transform", showStats && "rotate-180")} />
        </button>

        {/* More Menu */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
          className="p-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer rounded"
          title="更多选项"
        >
          <MoreHorizontal size={13} />
        </button>

        {/* Close / Hide Window */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCloseWindow();
          }}
          className="p-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer rounded"
          title="关闭悬浮助手"
        >
          <X size={13} />
        </button>
      </div>

      {/* Main Row: Pet Avatar + Middle Info + Right Control Button */}
      <div className="flex items-center w-full h-[58px] mt-0.5" data-drag="true">
        {/* Left Side: Avatar / Pet / Circular Ring according to Theme */}
        {theme !== "classic" ? (
          <FocusPetDisplay
            theme={theme}
            state={petState}
            size="md"
            isWalking={isDragging}
            direction={dragDirection}
            isPoked={isPetPoked}
            onPoke={onPokePet}
            className="shrink-0 mr-1.5"
          />
        ) : (
          /* Classic Light Circular Ring */
          <div className="relative size-11 flex items-center justify-center shrink-0 mr-1.5">
            <svg className="size-11 -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                className="stroke-slate-200/90 dark:stroke-slate-700/80"
                strokeWidth="3"
              />
              {status !== "ready" && (
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  className={cn(
                    "transition-all duration-300",
                    sessionType === "rest" ? "stroke-emerald-500" : "stroke-blue-500"
                  )}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="113.1"
                  strokeDashoffset={strokeDashoffset}
                />
              )}
            </svg>

            {/* Center Action Button (Classic) */}
            {status === "paused" ? (
              <div className="absolute inset-0 m-auto w-[33px] h-[26px] rounded-full bg-slate-50 dark:bg-slate-800/95 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume();
                  }}
                  className={cn(
                    "flex-1 h-full flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform",
                    sessionType === "rest"
                      ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      : "text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  )}
                  title={sessionType === "rest" ? "继续休息" : "继续专注"}
                >
                  <Play
                    size={10}
                    className={cn(
                      "ml-0.5",
                      sessionType === "rest"
                        ? "fill-emerald-600 dark:fill-emerald-400"
                        : "fill-blue-600 dark:fill-blue-400"
                    )}
                  />
                </button>
                <div className="w-[1px] h-3 bg-slate-200/90 dark:bg-slate-700 shrink-0" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sessionType === "rest") {
                      onSkipRest();
                    } else {
                      onStopFocusAndStartRest();
                    }
                  }}
                  className="flex-1 h-full flex items-center justify-center text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                  title={sessionType === "rest" ? "跳过休息" : "结束专注并开始休息"}
                >
                  <div className="size-2.5 rounded-[1.5px] bg-slate-600 dark:bg-slate-300 hover:bg-slate-800 dark:hover:bg-slate-100" />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (status === "ready") {
                    onStartFocus();
                  } else if (status === "running") {
                    onPause();
                  }
                }}
                className="absolute inset-0 m-auto size-8 rounded-full bg-slate-50 dark:bg-slate-800/90 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={
                  status === "running"
                    ? sessionType === "rest"
                      ? "暂停休息"
                      : "暂停专注"
                    : "开始专注"
                }
              >
                {status === "running" ? (
                  <Pause
                    size={14}
                    className={cn(
                      sessionType === "rest"
                        ? "text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400"
                        : "text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400"
                    )}
                  />
                ) : (
                  <Play
                    size={14}
                    className="text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400 ml-0.5"
                  />
                )}
              </button>
            )}
          </div>
        )}

        {/* Center: Title & Timer */}
        <div className="flex flex-col justify-center flex-1 min-w-0 pr-1" data-drag="true">
          {sessionType === "rest" ? (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-semibold select-none max-w-[85px] truncate",
                theme.startsWith("pixel")
                  ? "text-emerald-800 font-mono text-[11px]"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
              title="休息时段"
            >
              <Coffee size={12} className="shrink-0" />
              <span className="truncate">休息时段</span>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTaskSelector();
              }}
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium cursor-pointer select-none max-w-[85px] truncate text-left",
                theme.startsWith("pixel")
                  ? "text-amber-800 hover:text-amber-950 font-mono text-[11px]"
                  : "text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              )}
              title="点击选择关联任务/习惯"
            >
              <span className="truncate">{getTargetLabel(selectedTarget)}</span>
              <ChevronRight size={11} className="shrink-0 opacity-70" />
            </button>
          )}

          {/* Digital Timer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenTimeEditor();
            }}
            className={cn(
              "text-[22px] font-bold tracking-tight leading-none cursor-pointer select-none text-left mt-0.5",
              theme.startsWith("pixel") && "font-mono tracking-tighter text-amber-950",
              !theme.startsWith("pixel") &&
                sessionType === "rest" &&
                "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700",
              !theme.startsWith("pixel") &&
                sessionType !== "rest" &&
                "text-slate-900 dark:text-slate-100 hover:text-blue-600"
            )}
            title="点击修改时间设置"
          >
            {formatTime(secondsLeft)}
          </button>
        </div>

        {/* Right: Action / Play-Pause for Pet Themes (Pixel & Vector Card mode) */}
        {theme !== "classic" && (
          <div className="flex items-center justify-center shrink-0 mt-3 mr-0.5">
            {status === "paused" ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume();
                  }}
                  className={cn(
                    "size-6 rounded-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110",
                    theme.startsWith("pixel")
                      ? "bg-amber-200 border border-amber-900 text-amber-900"
                      : "bg-orange-100 text-orange-600"
                  )}
                  title={sessionType === "rest" ? "继续休息" : "继续专注"}
                >
                  <Play size={11} className="fill-current ml-0.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sessionType === "rest") {
                      onSkipRest();
                    } else {
                      onStopFocusAndStartRest();
                    }
                  }}
                  className={cn(
                    "size-6 rounded-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110",
                    theme.startsWith("pixel")
                      ? "bg-amber-200 border border-amber-900 text-amber-900"
                      : "bg-slate-100 text-slate-600"
                  )}
                  title={sessionType === "rest" ? "跳过休息" : "结束专注并开始休息"}
                >
                  <div className="size-2 rounded-[1px] bg-current" />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (status === "ready") {
                    onStartFocus();
                  } else if (status === "running") {
                    onPause();
                  }
                }}
                className={cn(
                  "size-7 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-xs",
                  theme.startsWith("pixel")
                    ? "bg-amber-300 border-2 border-amber-900 text-amber-950"
                    : sessionType === "rest"
                    ? "bg-emerald-500 text-white"
                    : "bg-orange-500 text-white"
                )}
                title={
                  status === "running"
                    ? sessionType === "rest"
                      ? "暂停休息"
                      : "暂停专注"
                    : "开始专注"
                }
              >
                {status === "running" ? (
                  <Pause size={12} className="fill-current" />
                ) : (
                  <Play size={12} className="fill-current ml-0.5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Expanded Stats Section */}
      {showStats && (
        <div
          className={cn(
            "pt-2 flex items-center justify-around text-center shrink-0 border-t",
            theme === "pixel"
              ? "border-amber-900/30 text-amber-950 font-mono"
              : "border-slate-200/60 dark:border-slate-800/80"
          )}
        >
          {/* Column 1: Today Focus */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] opacity-70 font-normal">今日专注</span>
            <span className="text-sm font-bold leading-tight">
              {stats.todayMinutes}
              <span className="text-[11px] font-normal opacity-80 ml-0.5">m</span>
            </span>
          </div>

          <div
            className={cn(
              "h-6 w-px",
              theme === "pixel" ? "bg-amber-900/30" : "bg-slate-200/60 dark:bg-slate-800/80"
            )}
          />

          {/* Column 2: This Week Focus */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] opacity-70 font-normal">本周专注</span>
            <span className="text-sm font-bold leading-tight">
              {stats.weekMinutes}
              <span className="text-[11px] font-normal opacity-80 ml-0.5">m</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
