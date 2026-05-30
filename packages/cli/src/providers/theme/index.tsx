import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { DEFAULT_THEME, THEMES, type Theme, type ThemeColors } from "./theme";

const CONFIG_DIR = resolve(process.cwd(), "config");
const CONFIG_PATH = join(CONFIG_DIR, "preferences.json");

function loadThemeNameFromDisk(): string {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return DEFAULT_THEME.name;
    }

    const raw = readFileSync(CONFIG_PATH, "utf8");

    if (!raw.trim()) {
      return DEFAULT_THEME.name;
    }

    const parsed = JSON.parse(raw);

    // New format
    if (typeof parsed.themeName === "string") {
      return parsed.themeName;
    }

    // Old format
    if (parsed.themeName && typeof parsed.themeName.name === "string") {
      return parsed.themeName.name;
    }

    return DEFAULT_THEME.name;
  } catch {
    return DEFAULT_THEME.name;
  }
}

function saveThemeNameToDisk(themeName: string) {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    writeFileSync(CONFIG_PATH, JSON.stringify({ themeName }, null, 2), "utf8");

    console.log("Saved theme:", themeName);
    console.log("Path:", CONFIG_PATH);
  } catch (err) {
    console.error(err);
  }
}

type ThemeContextValue = {
  colors: ThemeColors;
  currentTheme: Theme;
  previewTheme: (themeName: string) => void;
  commitTheme: (themeName: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState(() => loadThemeNameFromDisk());

  const currentTheme = useMemo(() => {
    return THEMES.find((t) => t.name === themeName) || DEFAULT_THEME;
  }, [themeName]);

  const previewTheme = useCallback((themeName: string) => {
    setThemeName(themeName);
  }, []);

  const commitTheme = useCallback((themeName: string) => {
    setThemeName(themeName);
    saveThemeNameToDisk(themeName);
  }, []);

  const value = useMemo(
    () => ({
      colors: currentTheme.colors,
      currentTheme,
      previewTheme,
      commitTheme,
    }),
    [currentTheme, previewTheme, commitTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
