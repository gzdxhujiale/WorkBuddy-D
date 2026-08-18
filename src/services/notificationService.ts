import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { getAppThemeStyle } from "@/lib/preferences";

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  } catch {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch {
        return false;
      }
    }
    return false;
  }
}

export interface DesktopNotificationOptions {
  petType?: "cat" | "dog" | "shiba";
  themeStyle?: "modern" | "pixel";
  eventType?: "focus_complete" | "rest_complete" | "general";
}

export async function sendDesktopNotification(
  title: string,
  body: string,
  options?: DesktopNotificationOptions
): Promise<void> {
  const petType = options?.petType || "cat";
  const themeStyle = options?.themeStyle || getAppThemeStyle();
  const eventType = options?.eventType || "focus_complete";

  // 1. Multi-monitor toast overlay windows across all connected displays
  try {
    await invoke("show_multi_monitor_notification", {
      title,
      body,
      petType,
      themeStyle,
      eventType,
    });
  } catch {
    // Non-Tauri fallback
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
  } catch {
    // Non-Tauri fallback
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
      } catch {
        // Ignore fallback error
      }
    }
  }
}
