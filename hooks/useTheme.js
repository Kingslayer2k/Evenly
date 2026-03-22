"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "evenly-theme";

export function applyThemeValue(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

export default function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    applyThemeValue(theme);
  }, [theme]);

  function setTheme(nextTheme) {
    const resolvedTheme = nextTheme === "dark" ? "dark" : "light";
    setThemeState(resolvedTheme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    }

    applyThemeValue(resolvedTheme);
  }

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
