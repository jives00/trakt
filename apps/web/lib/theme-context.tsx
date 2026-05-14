"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeId = "red-dark" | "blue-dark" | "red-light" | "blue-light";

export const THEMES = [
  { id: "red-dark" as const, label: "Red Dark", description: "Classic vivid red accent", previewColor: "#e8002d", mode: "dark" as const },
  { id: "blue-dark" as const, label: "Blue Dark", description: "Cool electric blue accent", previewColor: "#0066ff", mode: "dark" as const },
  { id: "red-light" as const, label: "Red Light", description: "Vivid red accent, light surfaces", previewColor: "#e8002d", mode: "light" as const },
  { id: "blue-light" as const, label: "Blue Light", description: "Electric blue accent, light surfaces", previewColor: "#0052cc", mode: "light" as const },
];

const VALID_THEMES: ThemeId[] = ["red-dark", "blue-dark", "red-light", "blue-light"];

interface ThemeState {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("red-dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as ThemeId | null;
    if (saved && VALID_THEMES.includes(saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    localStorage.setItem("theme", id);
    document.documentElement.setAttribute("data-theme", id);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
