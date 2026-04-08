import { createContext, use, useCallback, useState } from 'react';

import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DevToolsTheme = 'dark' | 'light';

export type DevToolsThemeContextValue = {
  theme: DevToolsTheme;
  isDark: boolean;
  toggleTheme: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const DevToolsThemeContext = createContext<DevToolsThemeContextValue>({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {}
});
DevToolsThemeContext.displayName = 'DevToolsThemeContext';

const useDevToolsTheme = () => use(DevToolsThemeContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'plitzi-devtools-theme';

const resolveInitialTheme = (defaultTheme: DevToolsTheme): DevToolsTheme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }

  return defaultTheme;
};

export type DevToolsThemeProviderProps = {
  defaultTheme?: DevToolsTheme;
  children?: ReactNode;
};

const DevToolsThemeProvider = ({ defaultTheme = 'dark', children }: DevToolsThemeProviderProps) => {
  const [theme, setTheme] = useState<DevToolsTheme>(() => resolveInitialTheme(defaultTheme));

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }

      return next;
    });
  }, []);

  return (
    <DevToolsThemeContext value={{ theme, isDark: theme === 'dark', toggleTheme }}>{children}</DevToolsThemeContext>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { DevToolsThemeContext, useDevToolsTheme };

export default DevToolsThemeProvider;
