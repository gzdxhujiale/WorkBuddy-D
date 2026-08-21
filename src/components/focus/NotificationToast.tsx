import React, { useEffect, useState, useRef } from "react";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { PixelPet } from "./pets/PixelPet";
import { PixelDog } from "./pets/PixelDog";
import { VectorPet } from "./pets/VectorPet";
import {
  X,
  Sparkles,
  Coffee,
  BellRing,
  Eye,
  Target,
  Clock,
  CheckCircle2,
  Flame,
  Moon,
  Zap,
} from "lucide-react";
import { showFocusAssistant } from "@/services/focusAssistantWindow";
import { cn } from "@/lib/utils";

interface ToastParams {
  title: string;
  body: string;
  petType: "cat" | "dog" | "shiba";
  themeStyle: "modern" | "pixel";
  eventType: "focus_complete" | "rest_complete" | "task_reminder" | "general";
  taskId?: string;
  isCenter: boolean;
}

export const NotificationToast: React.FC = () => {
  const [params, setParams] = useState<ToastParams>({
    title: "任务提醒",
    body: "任务已到达设定时间",
    petType: "cat",
    themeStyle: "modern",
    eventType: "task_reminder",
    isCenter: true,
  });
  const [isClosing, setIsClosing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [remainingSec, setRemainingSec] = useState(10);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Parse URL params
    const search = new URLSearchParams(window.location.search);
    const title = search.get("title") || "任务提醒";
    const body = search.get("body") || "任务已到达设定时间";
    const petType = (search.get("pet") as "cat" | "dog" | "shiba") || "cat";
    const themeStyle = (search.get("theme") as "modern" | "pixel") || "modern";
    const eventType =
      (search.get("type") as "focus_complete" | "rest_complete" | "task_reminder" | "general") ||
      "task_reminder";
    const taskId = search.get("task_id") || undefined;
    const isCenter = search.get("center") === "1" || search.get("idx") === null;

    setParams({ title, body, petType, themeStyle, eventType, taskId, isCenter });

    // Apply dark / pixel theme classes to root
    if (themeStyle === "pixel") {
      document.documentElement.classList.add("theme-retro-pixel");
    }

    const initialDuration = isCenter ? 10 : eventType === "task_reminder" ? 7 : 5;
    setRemainingSec(initialDuration);
  }, []);

  // Countdown timer with pause on hover
  useEffect(() => {
    if (isHovered || isClosing) return;

    timerRef.current = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          void handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, isClosing]);

  const handleClose = async () => {
    setIsClosing(true);
    setTimeout(async () => {
      try {
        const win = getCurrentWebviewWindow();
        await win.close();
      } catch {
        window.close();
      }
    }, 280);
  };

  const handleViewTask = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const mainWindow = await WebviewWindow.getByLabel("main");
      if (mainWindow) {
        await mainWindow.show();
        await mainWindow.unminimize();
        await mainWindow.setFocus();
      }
      if (params.taskId) {
        await emit("workbuddy:navigate-to-task", { taskId: params.taskId });
      }
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const handleStartFocusForTask = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await showFocusAssistant();
      if (params.taskId) {
        await emit("workbuddy:select-focus-task", {
          taskId: params.taskId,
          taskTitle: params.body,
        });
      }
      await emit("workbuddy:start-focus-action");
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const handleStartRest = async (durationMinutes = 5) => {
    try {
      await showFocusAssistant();
      await emit("workbuddy:start-rest-action", { durationMinutes });
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const handleExtendFocus = async (durationMinutes = 15) => {
    try {
      await showFocusAssistant();
      await emit("workbuddy:extend-focus-action", { durationMinutes });
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const handleExtendRest = async (durationMinutes = 3) => {
    try {
      await showFocusAssistant();
      await emit("workbuddy:extend-rest-action", { durationMinutes });
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const handleCompleteTask = async () => {
    try {
      if (params.taskId) {
        await emit("workbuddy:complete-task-action", { taskId: params.taskId });
      }
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const handleSnooze = async (snoozeMinutes = 5) => {
    try {
      if (params.taskId) {
        await emit("workbuddy:snooze-task-reminder", {
          taskId: params.taskId,
          snoozeMinutes,
        });
      }
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const isPixel = params.themeStyle === "pixel";
  const isFocusComplete = params.eventType === "focus_complete";
  const isRestComplete = params.eventType === "rest_complete";
  const isTaskReminder = params.eventType === "task_reminder";

  const renderPet = () => {
    const petState = isFocusComplete
      ? "celebrating"
      : isRestComplete
      ? "stretching"
      : "knocking";

    switch (params.petType) {
      case "dog":
        return <PixelDog state={petState} size="sm" />;
      case "shiba":
        return <VectorPet state={petState} size="sm" />;
      case "cat":
      default:
        return <PixelPet state={petState} size="sm" />;
    }
  };

  const getEventBadge = () => {
    if (isFocusComplete) {
      return {
        label: "🎉 专注已完成",
        subBadge: "+25 EXP",
        colorClass: isPixel
          ? "bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 border-amber-900"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        icon: <Sparkles className="size-3.5 text-amber-500 shrink-0" />,
      };
    }
    if (isRestComplete) {
      return {
        label: "☕ 休息已结束",
        subBadge: "精力充沛",
        colorClass: isPixel
          ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 border-emerald-900"
          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        icon: <Coffee className="size-3.5 text-emerald-500 shrink-0" />,
      };
    }
    if (isTaskReminder) {
      return {
        label: "⏰ 任务到期提醒",
        subBadge: "即刻行动",
        colorClass: isPixel
          ? "bg-indigo-200 dark:bg-indigo-900 text-indigo-950 dark:text-indigo-100 border-indigo-900"
          : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
        icon: <BellRing className="size-3.5 text-indigo-500 shrink-0 animate-bounce" />,
      };
    }
    return {
      label: "📢 WorkBuddy 提示",
      subBadge: "状态更新",
      colorClass: isPixel
        ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-700"
        : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
      icon: <Zap className="size-3.5 text-blue-500 shrink-0" />,
    };
  };

  const badge = getEventBadge();

  if (!params.isCenter) {
    // Multi-monitor Bottom-Right Compact Toast (340x96)
    return (
      <div className="w-screen h-screen flex items-center justify-center p-2 bg-transparent select-none overflow-hidden">
        <div
          onClick={isTaskReminder ? handleViewTask : handleClose}
          className={cn(
            "w-full h-full cursor-pointer relative overflow-hidden transition-all duration-300 flex items-center gap-3 px-3 py-2",
            isClosing ? "opacity-0 translate-x-12 scale-95" : "opacity-100 translate-x-0 scale-100",
            isPixel
              ? "bg-amber-50 dark:bg-amber-950 border-2 border-amber-800 dark:border-amber-500 shadow-[3px_3px_0px_#000] rounded-xs font-mono text-amber-950 dark:text-amber-100"
              : "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/90 shadow-2xl rounded-2xl text-slate-800 dark:text-slate-100"
          )}
        >
          {/* Animated Background Progress Bar */}
          <div
            className={cn(
              "absolute bottom-0 left-0 h-1 transition-all ease-linear pointer-events-none",
              isTaskReminder
                ? isPixel
                  ? "bg-indigo-600 dark:bg-indigo-400"
                  : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                : isFocusComplete
                ? isPixel
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-amber-400 to-orange-500"
                : isPixel
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-emerald-400 to-teal-500"
            )}
            style={{
              width: `${(remainingSec / 7) * 100}%`,
              transition: isHovered ? "none" : "width 1s linear",
            }}
          />

          {/* Pet Avatar Slot */}
          <div
            className={cn(
              "shrink-0 size-11 flex items-center justify-center rounded-xl",
              isTaskReminder
                ? isPixel
                  ? "bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-500"
                  : "bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 shadow-xs"
                : isFocusComplete
                ? isPixel
                  ? "bg-amber-100 dark:bg-amber-900/60 border border-amber-600"
                  : "bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300/60 shadow-xs"
                : isPixel
                ? "bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-600"
                : "bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300/60 shadow-xs"
            )}
          >
            {renderPet()}
          </div>

          {/* Content Body */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              {badge.icon}
              <span className="truncate font-semibold">{params.title}</span>
            </div>
            <p className="text-[11px] opacity-85 truncate mt-0.5 font-normal leading-tight">
              {params.body}
            </p>

            {/* Action Row */}
            <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
              {isTaskReminder && (
                <>
                  <button
                    type="button"
                    onClick={handleViewTask}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                      isPixel
                        ? "bg-amber-200 dark:bg-amber-900/80 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 border border-amber-800 rounded-xs"
                        : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20"
                    )}
                  >
                    <Eye className="size-2.5" />
                    <span>查看</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartFocusForTask}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                      isPixel
                        ? "bg-amber-600 hover:bg-amber-700 text-white border border-amber-900 rounded-xs shadow-[1px_1px_0px_#000]"
                        : "bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-xs"
                    )}
                  >
                    <Target className="size-2.5" />
                    <span>开启专注</span>
                  </button>
                </>
              )}
              {isFocusComplete && (
                <button
                  type="button"
                  onClick={() => handleStartRest(5)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                    isPixel
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-900 rounded-xs shadow-[1px_1px_0px_#000]"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-xs"
                  )}
                >
                  <Coffee className="size-2.5" />
                  <span>休息 5m</span>
                </button>
              )}
              {isRestComplete && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExtendRest(3)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                      isPixel
                        ? "bg-amber-200 dark:bg-amber-900/80 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 border border-amber-800 rounded-xs"
                        : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-md border border-orange-500/30"
                    )}
                  >
                    <Moon className="size-2.5 text-orange-400" />
                    <span>再眯 3m</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartFocusForTask}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                      isPixel
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-900 rounded-xs shadow-[1px_1px_0px_#000]"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-xs"
                    )}
                  >
                    <Target className="size-2.5" />
                    <span>开启专注</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleClose();
            }}
            className={cn(
              "shrink-0 size-6 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity",
              isPixel ? "hover:bg-amber-200 dark:hover:bg-amber-800" : "hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            )}
            title="关闭"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center p-2.5 bg-transparent select-none overflow-hidden">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "w-full h-full relative overflow-hidden transition-all duration-300 flex flex-col justify-between p-3.5",
          isClosing ? "opacity-0 scale-95 translate-y-3" : "opacity-100 scale-100 translate-y-0",
          isPixel
            ? "bg-amber-50 dark:bg-amber-950 border-3 border-amber-900 dark:border-amber-400 shadow-[6px_6px_0px_#000] rounded-xs font-mono text-amber-950 dark:text-amber-100"
            : "bg-slate-900/92 dark:bg-slate-950/95 backdrop-blur-2xl border border-white/15 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl text-slate-100"
        )}
      >
        {/* Animated Countdown Progress Bar */}
        <div
          className={cn(
            "absolute top-0 left-0 h-1 transition-all pointer-events-none",
            isFocusComplete
              ? isPixel
                ? "bg-amber-500"
                : "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500"
              : isRestComplete
              ? isPixel
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500"
              : isPixel
              ? "bg-indigo-600 dark:bg-indigo-400"
              : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
          )}
          style={{
            width: `${(remainingSec / (params.isCenter ? 10 : 7)) * 100}%`,
            transition: isHovered ? "none" : "width 1s linear",
          }}
        />

        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold border",
                isPixel ? "rounded-xs shadow-[1px_1px_0px_#000]" : "rounded-full shadow-xs",
                badge.colorClass
              )}
            >
              {badge.icon}
              <span>{badge.label}</span>
            </span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 opacity-80",
                isPixel
                  ? "bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 rounded-xs font-mono"
                  : "bg-white/10 text-slate-300 rounded-md"
              )}
            >
              {isHovered ? "倒计时已暂停" : `${remainingSec}s 自动关闭`}
            </span>
          </div>

          <button
            onClick={handleClose}
            className={cn(
              "size-6 flex items-center justify-center cursor-pointer transition-all opacity-70 hover:opacity-100",
              isPixel
                ? "rounded-xs border border-amber-900/60 bg-amber-100 dark:bg-amber-900 hover:bg-amber-200 text-amber-950 dark:text-amber-100 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                : "rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
            )}
            title="关闭 (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Middle Main Info Area */}
        <div className="flex items-center gap-3.5 my-1.5">
          {/* Pet Avatar Slot */}
          <div
            className={cn(
              "shrink-0 size-12 flex items-center justify-center overflow-hidden",
              isPixel
                ? "rounded-xs border-2 border-amber-900/70 bg-amber-200/90 dark:bg-amber-900/80 shadow-[2px_2px_0px_#000]"
                : "rounded-xl bg-white/10 dark:bg-slate-800/80 border border-white/10 shadow-inner"
            )}
          >
            {renderPet()}
          </div>

          {/* Text Details */}
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "truncate font-bold text-sm leading-tight",
                isPixel ? "font-mono text-amber-950 dark:text-amber-100" : "text-white"
              )}
            >
              {params.title}
            </h3>
            <p
              className={cn(
                "text-xs mt-1 line-clamp-2 leading-relaxed opacity-85",
                isPixel ? "text-amber-900/90 dark:text-amber-200/90" : "text-slate-300"
              )}
            >
              {params.body}
            </p>
          </div>
        </div>

        {/* Bottom Interactive Actions Bar */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10 dark:border-slate-800/80">
          {/* 1. FOCUS COMPLETE ACTIONS */}
          {isFocusComplete && (
            <>
              {params.taskId && (
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all",
                    isPixel
                      ? "rounded-xs border-2 border-emerald-900 bg-emerald-600 hover:bg-emerald-700 text-white shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                      : "rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 shadow-xs"
                  )}
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>完成本任务</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExtendFocus(15)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all",
                  isPixel
                    ? "rounded-xs border-2 border-amber-900 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 text-amber-950 dark:text-amber-100 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 shadow-xs"
                )}
              >
                <Flame className="size-3.5 text-amber-400" />
                <span>续战 15m</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartRest(5)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 text-xs font-bold cursor-pointer transition-all",
                  isPixel
                    ? "rounded-xs border-2 border-amber-900 bg-emerald-500 hover:bg-emerald-600 text-white shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md hover:shadow-emerald-500/20"
                )}
              >
                <Coffee className="size-3.5" />
                <span>开始休息 5m</span>
              </button>
            </>
          )}

          {/* 2. REST COMPLETE ACTIONS */}
          {isRestComplete && (
            <>
              <button
                type="button"
                onClick={() => handleExtendRest(3)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all",
                  isPixel
                    ? "rounded-xs border-2 border-amber-900 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 text-amber-950 dark:text-amber-100 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 shadow-xs"
                )}
              >
                <Moon className="size-3.5 text-orange-400" />
                <span>再眯 3m</span>
              </button>
              <button
                type="button"
                onClick={handleStartFocusForTask}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 text-xs font-bold cursor-pointer transition-all",
                  isPixel
                    ? "rounded-xs border-2 border-amber-900 bg-indigo-600 hover:bg-indigo-700 text-white shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white shadow-md hover:shadow-indigo-500/20"
                )}
              >
                <Target className="size-3.5" />
                <span>开启下个专注</span>
              </button>
            </>
          )}

          {/* 3. TASK REMINDER ACTIONS */}
          {isTaskReminder && (
            <>
              <button
                type="button"
                onClick={handleViewTask}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-xs font-medium cursor-pointer transition-all",
                  isPixel
                    ? "rounded-xs border border-amber-900/80 bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 text-amber-950 dark:text-amber-100 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
                )}
              >
                <Eye className="size-3.5" />
                <span>查看任务</span>
              </button>
              <button
                type="button"
                onClick={() => handleSnooze(5)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-xs font-medium cursor-pointer transition-all",
                  isPixel
                    ? "rounded-xs border border-amber-900/80 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 text-amber-950 dark:text-amber-100 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                )}
              >
                <Clock className="size-3.5 text-amber-400" />
                <span>5m 后再提醒</span>
              </button>
              <button
                type="button"
                onClick={handleStartFocusForTask}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 text-xs font-bold cursor-pointer transition-all",
                  isPixel
                    ? "rounded-xs border-2 border-amber-900 bg-indigo-600 hover:bg-indigo-700 text-white shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-blue-500/25"
                )}
              >
                <Target className="size-3.5" />
                <span>开启专注</span>
              </button>
            </>
          )}

          {/* 4. GENERAL NOTIFICATION ACTIONS */}
          {!isFocusComplete && !isRestComplete && !isTaskReminder && (
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "px-3 py-1 text-xs font-semibold cursor-pointer transition-all",
                isPixel
                  ? "rounded-xs border-2 border-amber-900 bg-amber-300 dark:bg-amber-800 hover:bg-amber-400 text-amber-950 dark:text-amber-100 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                  : "rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15"
              )}
            >
              <span>知道了</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


