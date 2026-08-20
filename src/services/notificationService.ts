import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { getAppThemeStyle } from "@/lib/preferences";
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
}

export async function sendDesktopNotification(
  title: string,
  body: string,
  options?: DesktopNotificationOptions
): Promise<void> {
  const petType = options?.petType || "cat";
  const themeStyle = options?.themeStyle || (getAppThemeStyle() === "retro-pixel" ? "pixel" : "modern");
  const eventType = options?.eventType || "focus_complete";
  const taskId = options?.taskId || null;

  // 1. Multi-monitor toast overlay windows across all connected displays
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
  }

  // 2. System Toast backup via Tauri notification plugin
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (granted) {
      sendNotification({
        title,
        body,
      });
      return;
    }
  } catch (error) {
    logError("notification", "System notification failed", error);
  }

  // 3. Browser / Webview standard Web Notification fallback
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, { body });
        }
      } catch (error) {
        logError("notification", "Browser notification request failed", error);
      }
    }
  }
}
