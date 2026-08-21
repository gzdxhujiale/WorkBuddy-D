import { emit } from "@tauri-apps/api/event";

export type AppThemeStyle = "default" | "retro-pixel";

const OPEN_FOCUS_ASSISTANT_ON_START_KEY = "workbuddy.openFocusAssistantOnStart";
const LEGACY_OPEN_FOCUS_ASSISTANT_ON_START_KEY = "fishbuddy.openFocusAssistantOnStart";

const APP_THEME_STYLE_KEY = "workbuddy.appThemeStyle";
const LEGACY_APP_THEME_STYLE_KEY = "fishbuddy.appThemeStyle";

export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

export function shouldOpenFocusAssistantOnStart(): boolean {
  return (localStorage.getItem(OPEN_FOCUS_ASSISTANT_ON_START_KEY) ?? localStorage.getItem(LEGACY_OPEN_FOCUS_ASSISTANT_ON_START_KEY)) === "true";
}

export function setOpenFocusAssistantOnStart(enabled: boolean): void {
  localStorage.setItem(OPEN_FOCUS_ASSISTANT_ON_START_KEY, String(enabled));
}

export function getAppThemeStyle(): AppThemeStyle {
  const saved = localStorage.getItem(APP_THEME_STYLE_KEY) ?? localStorage.getItem(LEGACY_APP_THEME_STYLE_KEY);
  if (saved === "retro-pixel" || saved === "default") {
    return saved;
  }
  return "retro-pixel";
}

export function setAppThemeStyle(style: AppThemeStyle): void {
  localStorage.setItem(APP_THEME_STYLE_KEY, style);
  applyAppThemeStyle(style);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workbuddy:theme-style-change", { detail: style }));
    if (isTauriEnv()) {
      void emit("workbuddy:theme-style-change", { style }).catch(() => {});
    }
  }
}

export function applyAppThemeStyle(style: AppThemeStyle = getAppThemeStyle()): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.themeStyle = style;
    document.documentElement.classList.toggle("theme-retro-pixel", style === "retro-pixel");
  }
}

export interface NotificationDisplayOptions {
  centerCard: boolean;      // 屏幕中央互动卡片 (默认 true)
  assistantBubble: boolean; // 桌面悬浮助手对话气泡 (默认 true)
  systemTray: boolean;      // 系统托盘通知 (默认 true)
}

const NOTIFICATION_DISPLAY_OPTIONS_KEY = "workbuddy.notificationDisplayOptions";

export const DEFAULT_NOTIFICATION_DISPLAY_OPTIONS: NotificationDisplayOptions = {
  centerCard: true,
  assistantBubble: true,
  systemTray: true,
};

export function getNotificationDisplayOptions(): NotificationDisplayOptions {
  try {
    const raw = localStorage.getItem(NOTIFICATION_DISPLAY_OPTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        centerCard: typeof parsed.centerCard === "boolean" ? parsed.centerCard : true,
        assistantBubble: typeof parsed.assistantBubble === "boolean" ? parsed.assistantBubble : true,
        systemTray: typeof parsed.systemTray === "boolean" ? parsed.systemTray : true,
      };
    }
  } catch {}
  return { ...DEFAULT_NOTIFICATION_DISPLAY_OPTIONS };
}

export function setNotificationDisplayOptions(options: Partial<NotificationDisplayOptions>): void {
  const current = getNotificationDisplayOptions();
  const next: NotificationDisplayOptions = { ...current, ...options };
  localStorage.setItem(NOTIFICATION_DISPLAY_OPTIONS_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workbuddy:notification-options-change", { detail: next }));
    if (isTauriEnv()) {
      void emit("workbuddy:notification-options-change", next).catch(() => {});
    }
  }
}

