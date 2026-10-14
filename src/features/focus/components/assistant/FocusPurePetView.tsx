import React from "react";
import { Play, Pause, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FocusSessionType } from "../../types";
import type { PetState } from "../pets/PixelPet";
import { SpeechBubble } from "../pets/SpeechBubble";
import { FocusPetDisplay } from "./FocusPetDisplay";
import { formatTime, getTargetLabel, SelectedTarget, Status, StyleTheme } from "./types";

export interface FocusPurePetViewProps {
  theme: StyleTheme;
  status: Status;
  sessionType: FocusSessionType;
  secondsLeft: number;
  selectedTarget: SelectedTarget;
  bubbleText: string | null;
  petState: PetState;
  isDragging: boolean;
  dragDirection: "left" | "right";
  isGlowActive: boolean;
  isPetPoked: boolean;
  onPokePet: () => void;
  onDismissBubble: () => void;
  onOpenMenu: () => void;
  onOpenTimeEditor: () => void;
  onOpenTaskSelector: () => void;
  onStartFocus: () => void;
  onPause: () => void;
  onResume: () => void;
  onStopFocusAndStartRest: () => void;
  onSkipRest: () => void;
}

export const FocusPurePetView: React.FC<FocusPurePetViewProps> = ({
  theme,
  status,
  sessionType,
  secondsLeft,
  selectedTarget,
  bubbleText,
  petState,
  isDragging,
  dragDirection,
  isGlowActive,
  isPetPoked,
  onPokePet,
  onDismissBubble,
  onOpenMenu,
  onOpenTimeEditor,
  onOpenTaskSelector,
  onStartFocus,
  onPause,
  onResume,
  onStopFocusAndStartRest,
  onSkipRest,
}) => {
  return (
    <div className="relative w-full h-full select-none flex flex-col items-center justify-between overflow-visible outline-none group mx-auto px-1 py-1">
      {/* Header: Speech Bubble or Timer Pill */}
      <div className="w-full h-[46px] flex items-end justify-center relative z-30 shrink-0 pb-0.5 pointer-events-auto">
        {bubbleText ? (
          <SpeechBubble
            text={bubbleText}
            theme={theme}
            onDismiss={onDismissBubble}
            className="max-w-[130px]"
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenTimeEditor();
            }}
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-bold transition-transform cursor-pointer hover:scale-105 active:scale-95 shadow-xs animate-in fade-in duration-150",
              theme.startsWith("pixel")
                ? "bg-amber-50 text-amber-950 border border-amber-900 font-mono text-[11px]"
                : sessionType === "rest"
                ? "bg-emerald-500/90 text-white backdrop-blur-xs text-[11px]"
                : "bg-orange-500/90 text-white backdrop-blur-xs text-[11px]"
            )}
            title="点击修改专注/休息时间（右键宠物呼出菜单）"
          >
            {sessionType === "rest" && "☕ "}
            {formatTime(secondsLeft)}
          </button>
        )}
      </div>

      {/* Pet Display */}
      <div
        className={cn(
          "relative h-[80px] w-full flex items-center justify-center pointer-events-auto transition-all duration-300 rounded-full shrink-0",
          isGlowActive &&
            "ring-8 ring-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-pulse"
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenMenu();
        }}
      >
        <FocusPetDisplay
          theme={theme}
          state={petState}
          size="lg"
          isWalking={isDragging}
          direction={dragDirection}
          isPoked={isPetPoked}
          onPoke={onPokePet}
        />
      </div>

      {/* Footer Actions */}
      <div className="h-[28px] w-full flex items-start justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-20 shrink-0">
        {status === "paused" ? (
          <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 p-0.5 rounded-full shadow-md border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResume();
              }}
              className="size-5 rounded-full bg-blue-500 text-white flex items-center justify-center cursor-pointer hover:scale-110"
            >
              <Play size={9} className="fill-current ml-0.5" />
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
              className="size-5 rounded-full bg-slate-500 text-white flex items-center justify-center cursor-pointer hover:scale-110"
            >
              <div className="size-1.5 bg-white rounded-[0.5px]" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenMenu();
              }}
              className="size-5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
            >
              <MoreHorizontal size={11} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 px-1 py-0.5 rounded-full shadow-md border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (status === "ready") {
                  onStartFocus();
                } else {
                  onPause();
                }
              }}
              className={cn(
                "size-5 rounded-full text-white flex items-center justify-center cursor-pointer hover:scale-110",
                sessionType === "rest" ? "bg-emerald-500" : "bg-orange-500"
              )}
            >
              {status === "running" ? (
                <Pause size={10} className="fill-current" />
              ) : (
                <Play size={10} className="fill-current ml-0.5" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTaskSelector();
              }}
              className="px-1 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 hover:text-blue-500 max-w-[55px] truncate cursor-pointer font-medium"
            >
              {getTargetLabel(selectedTarget)}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenMenu();
              }}
              className="size-5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
            >
              <MoreHorizontal size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
