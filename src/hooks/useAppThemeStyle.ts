import { useState, useEffect, useCallback } from "react";
import { AppThemeStyle, getAppThemeStyle, setAppThemeStyle, applyAppThemeStyle, isTauriEnv } from "@/lib/preferences";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export function useAppThemeStyle() {
  const [themeStyle, setThemeStyleState] = useState<AppThemeStyle>(getAppThemeStyle);

  useEffect(() => {
    // 确保当前窗口的 documentElement 应用最新风格
    applyAppThemeStyle();

    const handleStyleChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppThemeStyle>;
      const newStyle = customEvent.detail || getAppThemeStyle();
      applyAppThemeStyle(newStyle);
      setThemeStyleState(newStyle);
    };

    window.addEventListener("workbuddy:theme-style-change", handleStyleChange);
    window.addEventListener("storage", handleStyleChange);

    let unlistenTauri: Promise<UnlistenFn> | null = null;
    if (isTauriEnv()) {
      unlistenTauri = listen<{ style: AppThemeStyle }>("workbuddy:theme-style-change", (event) => {
        const newStyle = event.payload?.style || getAppThemeStyle();
        applyAppThemeStyle(newStyle);
        setThemeStyleState(newStyle);
      });
    }

    return () => {
      window.removeEventListener("workbuddy:theme-style-change", handleStyleChange);
      window.removeEventListener("storage", handleStyleChange);
      if (unlistenTauri) {
        unlistenTauri.then((fn) => fn()).catch(() => {});
      }
    };
  }, []);

  const setThemeStyle = useCallback((style: AppThemeStyle) => {
    setAppThemeStyle(style);
    setThemeStyleState(style);
  }, []);

  return {
    themeStyle,
    setThemeStyle,
    isPixelTheme: themeStyle === "retro-pixel",
  };
}

