import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { createContext, useCallback, useEffect } from 'react';

import getSystemTheme from './helpers/getSystemTheme';

import type { Theme, ThemeContextValue } from '../types';
import type { ReactNode } from 'react';

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', isDark: true, toggleTheme: () => {} });
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
  const isSystem = defaultTheme === 'system';
  const [theme, setTheme] = useStorage<Theme>(
    storageKey,
    defaultTheme === 'system' ? getSystemTheme() : defaultTheme,
    storageType
  );

  // When in system mode, track OS preference changes
  useEffect(() => {
    if (!isSystem) {
      return;
    }

    const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq?.addEventListener('change', handler);

    return () => mq?.removeEventListener('change', handler);
  }, [isSystem, setTheme]);

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

    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, [isSystem, setTheme]);

  return <ThemeContext value={{ theme, isDark: theme === 'dark', toggleTheme }}>{children}</ThemeContext>;
};

export { ThemeContext };

export default ThemeProvider;
