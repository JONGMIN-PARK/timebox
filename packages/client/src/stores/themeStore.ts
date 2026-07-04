import { create } from "zustand";

type Theme = "light" | "dark" | "system";

/** Accent color themes. "blue" is the default (uses the :root palette). */
export const ACCENTS = [
  "blue",
  "violet",
  "emerald",
  "rose",
  "amber",
  "teal",
  "indigo",
  "fuchsia",
  "cyan",
  "orange",
  "pink",
] as const;
export type Accent = (typeof ACCENTS)[number];

/** Representative swatch color (500 shade) for each accent, for the picker UI. */
export const ACCENT_SWATCH: Record<Accent, string> = {
  blue: "#3b82f6",
  violet: "#8b5cf6",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  teal: "#14b8a6",
  indigo: "#6366f1",
  fuchsia: "#d946ef",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
};

interface ThemeState {
  theme: Theme;
  accent: Accent;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
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

function isAccent(v: string | null): v is Accent {
  return !!v && (ACCENTS as readonly string[]).includes(v);
}

function applyAccent(accent: Accent) {
  // "blue" is the :root default, so no attribute is needed for it.
  if (accent === "blue") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", accent);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem("timebox_theme") as Theme) || "system",
  accent: (isAccent(localStorage.getItem("timebox_accent")) ? (localStorage.getItem("timebox_accent") as Accent) : "blue"),

  setTheme: (theme) => {
    localStorage.setItem("timebox_theme", theme);
    applyTheme(theme);
    set({ theme });
  },

  setAccent: (accent) => {
    localStorage.setItem("timebox_accent", accent);
    applyAccent(accent);
    set({ accent });
  },

  initTheme: () => {
    const saved = (localStorage.getItem("timebox_theme") as Theme) || "system";
    applyTheme(saved);
    const savedAccent = isAccent(localStorage.getItem("timebox_accent")) ? (localStorage.getItem("timebox_accent") as Accent) : "blue";
    applyAccent(savedAccent);
    set({ theme: saved, accent: savedAccent });

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const current = (localStorage.getItem("timebox_theme") as Theme) || "system";
      if (current === "system") applyTheme("system");
    });
  },
}));
