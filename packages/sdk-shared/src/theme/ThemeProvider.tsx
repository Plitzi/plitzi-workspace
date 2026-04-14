import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { createContext, useCallback, useEffect, useMemo } from 'react';

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

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    // via Class
    const syncTheme = () => setThemeMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const mutationObserver = new MutationObserver(syncTheme);
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // via Media

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setThemeMode(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);

    return () => {
      mutationObserver.disconnect();
      mq.removeEventListener('change', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeMode]);

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
