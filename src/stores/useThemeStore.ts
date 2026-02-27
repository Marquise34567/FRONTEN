import { create } from "zustand";

export type AppThemeId = "dark-premium" | "light-minimal" | "neon-2026" | "holographic-glass";

export type AppThemeOption = {
  id: AppThemeId;
  label: string;
  description: string;
};

const STORAGE_KEY = "autoeditor-theme";

export const APP_THEME_OPTIONS: AppThemeOption[] = [
  { id: "dark-premium", label: "Dark Premium", description: "Deep dark surfaces with violet accents." },
  { id: "light-minimal", label: "Light Minimal", description: "Bright editorial canvas for daytime workflows." },
  { id: "neon-2026", label: "Neon 2026", description: "Electric glows and high-energy signal visuals." },
  { id: "holographic-glass", label: "Holographic Glass", description: "Refraction-heavy glass and chromatic depth." },
];

const DEFAULT_THEME: AppThemeId = "dark-premium";

const isThemeId = (value: string): value is AppThemeId => APP_THEME_OPTIONS.some((option) => option.id === value);

const applyThemeToDocument = (theme: AppThemeId) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
};

type ThemeStoreState = {
  theme: AppThemeId;
  hydrated: boolean;
  setTheme: (theme: AppThemeId) => void;
  hydrate: () => void;
};

export const useThemeStore = create<ThemeStoreState>((set) => ({
  theme: DEFAULT_THEME,
  hydrated: false,
  setTheme: (theme) => {
    applyThemeToDocument(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
    set({ theme });
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) || "";
    const resolvedTheme = isThemeId(saved) ? saved : DEFAULT_THEME;
    applyThemeToDocument(resolvedTheme);
    set({ theme: resolvedTheme, hydrated: true });
  },
}));
