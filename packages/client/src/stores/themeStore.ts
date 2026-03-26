import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem("timebox_theme") as Theme) || "system",

  setTheme: (theme) => {
    localStorage.setItem("timebox_theme", theme);
    applyTheme(theme);
    set({ theme });
  },

  initTheme: () => {
    const saved = (localStorage.getItem("timebox_theme") as Theme) || "system";
    applyTheme(saved);
    set({ theme: saved });

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const current = (localStorage.getItem("timebox_theme") as Theme) || "system";
      if (current === "system") applyTheme("system");
    });
  },
}));
