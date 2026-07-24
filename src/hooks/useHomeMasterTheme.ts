import { useEffect, useState } from "react";

export type HomeMasterTheme = "light" | "dark";

export const HOME_MASTER_THEME_STORAGE_KEY = "vyva:home-master-theme:v1";
export const HOME_MASTER_THEME_CHANGED_EVENT = "vyva:home-master-theme-changed";

function isHomeMasterTheme(value: string | null): value is HomeMasterTheme {
  return value === "light" || value === "dark";
}

export function readHomeMasterTheme(): HomeMasterTheme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(HOME_MASTER_THEME_STORAGE_KEY);
  return isHomeMasterTheme(stored) ? stored : "light";
}

export function writeHomeMasterTheme(theme: HomeMasterTheme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent(HOME_MASTER_THEME_CHANGED_EVENT, { detail: { theme } }));
}

export function useHomeMasterTheme() {
  const [theme, setTheme] = useState<HomeMasterTheme>(() => readHomeMasterTheme());

  useEffect(() => {
    const syncTheme = () => setTheme(readHomeMasterTheme());
    window.addEventListener("storage", syncTheme);
    window.addEventListener(HOME_MASTER_THEME_CHANGED_EVENT, syncTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener(HOME_MASTER_THEME_CHANGED_EVENT, syncTheme);
    };
  }, []);

  const nextTheme: HomeMasterTheme = theme === "dark" ? "light" : "dark";

  return {
    theme,
    isDark: theme === "dark",
    setTheme: writeHomeMasterTheme,
    toggleTheme: () => writeHomeMasterTheme(nextTheme),
  };
}
