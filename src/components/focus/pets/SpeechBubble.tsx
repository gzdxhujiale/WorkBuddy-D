import React from "react";
import { cn } from "@/lib/utils";
import type { StyleTheme } from "../FocusAssistant";

interface SpeechBubbleProps {
  text: string;
  theme?: StyleTheme;
  onDismiss?: () => void;
  className?: string;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  theme = "classic",
  onDismiss,
  className,
}) => {
  if (!text) return null;

  const isPixel = theme.startsWith("pixel");

  if (isPixel) {
    return (
      <div
        onClick={onDismiss}
        className={cn(
          "relative z-50 cursor-pointer select-none mx-auto w-fit max-w-[200px]",
          "animate-in fade-in zoom-in-95 duration-200",
          className
        )}
        title="点击关闭气泡"
      >
        <div className="relative bg-amber-50 text-amber-950 text-[11px] font-bold px-2.5 py-1 border-2 border-amber-900 shadow-[2px_2px_0px_rgba(120,53,15,1)] whitespace-normal break-words text-center leading-snug">
          {text}
          {/* Pixel Tail */}
          <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2 h-1 bg-amber-50 border-r-2 border-b-2 border-amber-900 rotate-45" />
        </div>
      </div>
    );
  }

  // Modern Vector and Classic theme bubble
  return (
    <div
      onClick={onDismiss}
      className={cn(
        "relative z-50 cursor-pointer select-none mx-auto w-fit max-w-[200px]",
        "animate-in fade-in slide-in-from-top-1 duration-200",
        className
      )}
      title="点击关闭气泡"
    >
      <div className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-md text-slate-800 dark:text-slate-100 text-[11px] font-semibold px-3 py-1 rounded-xl shadow-lg border border-slate-200/90 dark:border-slate-700/90 whitespace-normal break-words text-center leading-snug">
        {text}
        {/* Rounded Tail */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-2 bg-white/95 dark:bg-slate-800/95 border-r border-b border-slate-200/90 dark:border-slate-700/90 rotate-45" />
      </div>
    </div>
  );
};
