import { createContext, useCallback, useEffect, useState } from 'react';

import type { ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type ThemeDefaultValue = Theme | 'system';

export type ThemeContextValue = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', isDark: true, toggleTheme: () => {} });
ThemeContext.displayName = 'ThemeContext';

const getSystemTheme = (): Theme => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
};

const resolveInitialTheme = (storageKey: string | undefined, defaultTheme: ThemeDefaultValue): Theme => {
  if (storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
  }

  return defaultTheme === 'system' ? getSystemTheme() : defaultTheme;
};

export type ThemeProviderProps = {
  defaultTheme?: ThemeDefaultValue;
  storageKey?: string;
  children?: ReactNode;
};

const ThemeProvider = ({ defaultTheme = 'dark', storageKey, children }: ThemeProviderProps) => {
  const isSystem = defaultTheme === 'system';

  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme(storageKey, defaultTheme));

  // When in system mode, track OS preference changes
  useEffect(() => {
    if (!isSystem) {
      return;
    }

    const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq?.addEventListener('change', handler);

    return () => mq?.removeEventListener('change', handler);
  }, [isSystem]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    if (isSystem) {
      return;
    }

    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, next);
        } catch {
          // ignore
        }
      }

      return next;
    });
  }, [isSystem, storageKey]);

  return <ThemeContext value={{ theme, isDark: theme === 'dark', toggleTheme }}>{children}</ThemeContext>;
};

export { ThemeContext };

export default ThemeProvider;
