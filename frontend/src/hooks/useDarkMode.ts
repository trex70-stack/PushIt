import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) ?? "system";
  });

  useEffect(() => {
    const dark = theme === "dark" || (theme === "system" && getSystemDark());
    applyDark(dark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // System-Präferenz live verfolgen wenn theme === "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const isDark =
    theme === "dark" || (theme === "system" && getSystemDark());

  return { theme, setTheme, isDark };
}
