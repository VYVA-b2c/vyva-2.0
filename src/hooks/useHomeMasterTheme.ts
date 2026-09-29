import { useEffect, useState } from "react";

export type HomeMasterTheme = "light" | "dark";

export const HOME_MASTER_THEME_STORAGE_KEY = "vyva:home-master-theme:v1";
export const HOME_MASTER_THEME_CHANGED_EVENT = "vyva:home-master-theme-changed";

function isHomeMasterTheme(value: string | null): value is HomeMasterTheme {
  return value === "light" || value === "dark";
}

function readThemeOverride(): HomeMasterTheme | null {
  if (typeof window === "undefined") return null;
  const override = new URLSearchParams(window.location.search).get("theme");
  return isHomeMasterTheme(override) ? override : null;
}

export function readHomeMasterTheme(): HomeMasterTheme {
  if (typeof window === "undefined") return "dark";
  const override = readThemeOverride();
  if (override) return override;
  const stored = window.localStorage.getItem(HOME_MASTER_THEME_STORAGE_KEY);
  return isHomeMasterTheme(stored) ? stored : "dark";
}

export function writeHomeMasterTheme(theme: HomeMasterTheme) {
  if (typeof window === "undefined") return;
  const search = new URLSearchParams(window.location.search);
  if (isHomeMasterTheme(search.get("theme"))) {
    search.set("theme", theme);
    const nextSearch = search.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
    );
  }
  window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent(HOME_MASTER_THEME_CHANGED_EVENT, { detail: { theme } }));
}

export function useHomeMasterTheme() {
  const [theme, setTheme] = useState<HomeMasterTheme>(() => readHomeMasterTheme());

  useEffect(() => {
    const syncTheme = () => setTheme(readHomeMasterTheme());
    window.addEventListener("storage", syncTheme);
    window.addEventListener(HOME_MASTER_THEME_CHANGED_EVENT, syncTheme);
    window.addEventListener("popstate", syncTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener(HOME_MASTER_THEME_CHANGED_EVENT, syncTheme);
      window.removeEventListener("popstate", syncTheme);
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
