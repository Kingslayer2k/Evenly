"use client";

import { useEffect } from "react";
import { applyThemeValue, THEME_STORAGE_KEY } from "../hooks/useTheme";

export default function ThemeProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    applyThemeValue(storedTheme === "dark" ? "dark" : "light");
  }, []);

  return null;
}
