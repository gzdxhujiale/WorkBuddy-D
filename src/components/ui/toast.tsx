import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Info } from "lucide-react";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  isFadingOut?: boolean;
}

type ToastListener = (toast: ToastItem) => void;

class ToastManager {
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(message: string, type: ToastType = "info", duration = 3000) {
    const item: ToastItem = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      duration,
    };
    this.listeners.forEach((listener) => listener(item));
  }

  success(message: string, duration = 3000) {
    this.show(message, "success", duration);
  }

  error(message: string, duration = 3000) {
    this.show(message, "error", duration);
  }

  info(message: string, duration = 3000) {
    this.show(message, "info", duration);
  }
}

export const toast = new ToastManager();

export function Toaster() {
  const { isPixelTheme } = useAppThemeStyle();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((newToast) => {
      setToasts((prev) => [...prev, newToast]);

      const fadeTimer = setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === newToast.id ? { ...t, isFadingOut: true } : t))
        );
      }, (newToast.duration ?? 3000) - 300);

      const removeTimer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration ?? 3000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[1200] flex flex-col gap-2 pointer-events-none select-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-3 transition-all duration-300",
            isPixelTheme
              ? "rounded-xs border-2 border-border bg-popover text-popover-foreground shadow-[4px_4px_0px_#000] font-mono text-xs px-3.5 py-2.5"
              : "px-4 py-3 rounded-2xl bg-foreground/90 dark:bg-background/90 text-background dark:text-foreground shadow-2xl backdrop-blur-md border border-border text-sm font-medium",
            t.isFadingOut ? "opacity-0 translate-y-2" : "animate-in slide-in-from-bottom-4"
          )}
        >
          {t.type === "success" && (
            <CheckCircle size={18} className={cn("shrink-0", isPixelTheme ? "text-emerald-500" : "text-emerald-400 dark:text-emerald-500")} />
          )}
          {t.type === "error" && (
            <AlertCircle size={18} className={cn("shrink-0", isPixelTheme ? "text-red-500" : "text-red-400 dark:text-red-500")} />
          )}
          {t.type === "info" && (
            <Info size={18} className={cn("shrink-0", isPixelTheme ? "text-amber-500" : "text-blue-400 dark:text-blue-500")} />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
