import { useState, useEffect, useCallback } from "react";
import { AppThemeStyle, getAppThemeStyle, setAppThemeStyle } from "@/lib/preferences";

export function useAppThemeStyle() {
  const [themeStyle, setThemeStyleState] = useState<AppThemeStyle>(getAppThemeStyle);

  useEffect(() => {
    const handleStyleChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppThemeStyle>;
      if (customEvent.detail) {
        setThemeStyleState(customEvent.detail);
      } else {
        setThemeStyleState(getAppThemeStyle());
      }
    };

    window.addEventListener("workbuddy:theme-style-change", handleStyleChange);
    window.addEventListener("storage", handleStyleChange);

    return () => {
      window.removeEventListener("workbuddy:theme-style-change", handleStyleChange);
      window.removeEventListener("storage", handleStyleChange);
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
