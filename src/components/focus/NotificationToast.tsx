import React, { useEffect, useState } from "react";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { PixelPet } from "./pets/PixelPet";
import { PixelDog } from "./pets/PixelDog";
import { VectorPet } from "./pets/VectorPet";
import { X, Sparkles, Coffee, BellRing, Eye, Target } from "lucide-react";
import { showFocusAssistant } from "@/services/focusAssistantWindow";
import { cn } from "@/lib/utils";

interface ToastParams {
  title: string;
  body: string;
  petType: "cat" | "dog" | "shiba";
  themeStyle: "modern" | "pixel";
  eventType: "focus_complete" | "rest_complete" | "task_reminder" | "general";
  taskId?: string;
}

export const NotificationToast: React.FC = () => {
  const [params, setParams] = useState<ToastParams>({
    title: "任务提醒",
    body: "任务已到达设定时间",
    petType: "cat",
    themeStyle: "modern",
    eventType: "task_reminder",
  });
  const [isClosing, setIsClosing] = useState(false);

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

    setParams({ title, body, petType, themeStyle, eventType, taskId });

    // Apply dark / pixel theme classes to root
    if (themeStyle === "pixel") {
      document.documentElement.classList.add("theme-retro-pixel");
    }

    const duration = eventType === "task_reminder" ? 6500 : 4500;
    // Auto-close countdown
    const closeTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(closeTimer);
  }, []);

  const handleClose = async () => {
    setIsClosing(true);
    setTimeout(async () => {
      try {
        const win = getCurrentWebviewWindow();
        await win.close();
      } catch {
        window.close();
      }
    }, 300);
  };

  const handleViewTask = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleStartFocus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await showFocusAssistant();
      if (params.taskId) {
        await emit("workbuddy:select-focus-task", {
          taskId: params.taskId,
          taskTitle: params.body,
        });
      }
    } catch {
      // Fallback
    }
    void handleClose();
  };

  const isPixel = params.themeStyle === "pixel";
  const isFocusComplete = params.eventType === "focus_complete";
  const isTaskReminder = params.eventType === "task_reminder";

  const renderPet = () => {
    const petState = isFocusComplete ? "celebrating" : "knocking";
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
            animation: `shrinkWidth ${isTaskReminder ? "6.5s" : "4.5s"} linear forwards`,
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
            {isTaskReminder ? (
              <BellRing className="size-3.5 text-indigo-500 shrink-0 animate-bounce" />
            ) : isFocusComplete ? (
              <Sparkles className="size-3.5 text-amber-500 shrink-0" />
            ) : (
              <Coffee className="size-3.5 text-emerald-500 shrink-0" />
            )}
            <span className="truncate font-semibold">{params.title}</span>
          </div>
          <p className="text-[11px] opacity-85 truncate mt-0.5 font-normal leading-tight">
            {params.body}
          </p>

          {/* Action Row for Task Reminder */}
          {isTaskReminder && (
            <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
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
                onClick={handleStartFocus}
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
            </div>
          )}
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

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
