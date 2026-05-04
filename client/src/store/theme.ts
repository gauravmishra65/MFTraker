import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      toggle: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        document.documentElement.classList.toggle("dark", next === "dark");
        set({ theme: next });
      }
    }),
    {
      name: "tracker-theme",
      onRehydrateStorage: () => (state) => {
        if (state) document.documentElement.classList.toggle("dark", state.theme === "dark");
      }
    }
  )
);
