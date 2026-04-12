import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import getSystemTheme from './helpers/getSystemTheme';

import type { Theme, ThemeContextValue } from '../types';
import type { ReactNode } from 'react';

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggleTheme: () => {} });
ThemeContext.displayName = 'ThemeContext';

export type ThemeProviderProps = {
  defaultTheme?: Theme;
  storageKey?: string;
  storageType?: 'localStorage' | 'sessionStorage';
  children?: ReactNode;
};

const ThemeProvider = ({
  defaultTheme = 'dark',
  storageKey = 'theme',
  storageType = 'localStorage',
  children
}: ThemeProviderProps) => {
  const [themeMode, setThemeMode] = useStorage<Theme>(storageKey, defaultTheme, storageType);

  // Track OS preference changes (needed when mode is 'system')
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme());

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq?.addEventListener('change', handler);

    return () => mq?.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = useMemo<Theme>(
    () => (themeMode === 'system' ? systemTheme : themeMode),
    [themeMode, systemTheme]
  );

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const toggleTheme = useCallback(() => {
    setThemeMode(prev => {
      if (prev === 'dark') {
        return 'light';
      }

      return 'dark';
    });
  }, [setThemeMode]);

  const themeValue = useMemo(() => ({ theme: themeMode, toggleTheme }), [themeMode, toggleTheme]);

  return <ThemeContext value={themeValue}>{children}</ThemeContext>;
};

export { ThemeContext };

export default ThemeProvider;
