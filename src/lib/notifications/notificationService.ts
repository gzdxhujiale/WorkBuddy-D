import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { getAppThemeStyle, getNotificationDisplayOptions } from "@/lib/preferences";
import { logError } from "@/lib/syncEngine";

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  } catch (error) {
    logError("notification", "Tauri notification permission request failed", error);
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch (browserError) {
        logError("notification", "Browser notification permission request failed", browserError);
        return false;
      }
    }
    return false;
  }
}

export interface DesktopNotificationOptions {
  petType?: "cat" | "dog" | "shiba";
  themeStyle?: "modern" | "pixel";
  eventType?: "focus_complete" | "rest_complete" | "task_reminder" | "general";
  taskId?: string;
  forceCenterCard?: boolean;
}

export async function sendDesktopNotification(
  title: string,
  body: string,
  options?: DesktopNotificationOptions
): Promise<void> {
  const displayOptions = getNotificationDisplayOptions();
  const petType = options?.petType || "cat";
  const themeStyle = options?.themeStyle || (getAppThemeStyle() === "retro-pixel" ? "pixel" : "modern");
  const eventType = options?.eventType || "focus_complete";
  const taskId = options?.taskId || null;

  // 1. Screen Center Interactive Notification Card (HUD modal)
  if (displayOptions.centerCard || options?.forceCenterCard) {
    try {
      await invoke("show_center_interactive_notification", {
        title,
        body,
        petType,
        themeStyle,
        eventType,
        taskId,
      });
    } catch (error) {
      logError("notification", "Center interactive notification failed", error);
    }
  }

  // 2. Custom Multi-Monitor Bottom-Right Toast Overlay Windows
  if (displayOptions.systemTray) {
    try {
      await invoke("show_multi_monitor_notification", {
        title,
        body,
        petType,
        themeStyle,
        eventType,
        taskId,
      });
    } catch (error) {
      logError("notification", "Multi-monitor notification failed", error);
      // Fallback to system notification plugin if webview window creation fails
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === "granted";
        }
        if (granted) {
          sendNotification({ title, body });
          return;
        }
      } catch (sysErr) {
        logError("notification", "System notification fallback failed", sysErr);
      }
    }
  }

}

