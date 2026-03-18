import React, { createContext, useContext, useMemo } from "react";

interface ThemeContextValue {
  mode: "light";
  isDark: false;
  toggleTheme: () => void;
  setTheme: (mode: "light") => void;
}

const noop = () => {};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  isDark: false,
  toggleTheme: noop,
  setTheme: noop,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<ThemeContextValue>(
    () => ({ mode: "light", isDark: false, toggleTheme: noop, setTheme: noop }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
