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

