import React, { createContext, useContext, useEffect } from "react";
import { Platform } from "react-native";
import { useSettings } from "./hooks";
import { PALETTES, themeCssVariables, type Palette, type ThemeName } from "./theme";

interface ThemeControls {
  name: ThemeName;
  palette: Palette;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeControls>({
  name: "light",
  palette: PALETTES.light,
  setThemeName: () => {},
});

// Inject the CSS custom properties once, at module load, so the variables exist
// before the first paint (no flash of unstyled color). Default the document to
// light until the stored preference loads.
if (Platform.OS === "web" && typeof document !== "undefined") {
  if (!document.getElementById("theme-vars")) {
    const style = document.createElement("style");
    style.id = "theme-vars";
    style.textContent = themeCssVariables();
    document.head.appendChild(style);
  }
  if (!document.documentElement.dataset.theme) {
    document.documentElement.dataset.theme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, update } = useSettings();
  const name: ThemeName = settings.themeName === "night" ? "night" : "light";

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.dataset.theme = name;
    }
  }, [name]);

  const setThemeName = (next: ThemeName) => {
    void update("themeName", next);
  };

  return (
    <ThemeContext.Provider value={{ name, palette: PALETTES[name], setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemeControls = () => useContext(ThemeContext);
export const useThemeName = () => useContext(ThemeContext).name;
export const useThemePalette = () => useContext(ThemeContext).palette;
