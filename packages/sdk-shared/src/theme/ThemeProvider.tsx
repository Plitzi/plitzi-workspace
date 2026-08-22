import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { createContext, useCallback, useEffect, useMemo } from 'react';

import useResolvedScheme from './useResolvedScheme';

import type { Theme, ThemeContextValue } from '../types';
import type { ReactNode } from 'react';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {}
});
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
  const resolvedTheme = useResolvedScheme(themeMode);

  /**
   * The root carries the CHOICE, and only when there is one.
   *
   * `system` writes no class at all, which is what lets the stylesheet's `prefers-color-scheme` queries answer —
   * they are guarded on the absence of these classes, so a class present is a visitor overruling their machine.
   * Writing `light` explicitly matters as much as writing `dark`: removing a class cannot express "I want light
   * on a machine set to dark".
   */
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.classList.toggle('dark', themeMode === 'dark');
    root.classList.toggle('light', themeMode === 'light');
  }, [themeMode]);

  /** A toggle means "the opposite of what I am looking at", which from `system` is the machine's answer flipped. */
  const toggleTheme = useCallback(
    () => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark'),
    [resolvedTheme, setThemeMode]
  );

  const themeValue = useMemo(
    () => ({ theme: themeMode, resolvedTheme, setTheme: setThemeMode, toggleTheme }),
    [themeMode, resolvedTheme, setThemeMode, toggleTheme]
  );

  return <ThemeContext value={themeValue}>{children}</ThemeContext>;
};

export { ThemeContext };

export default ThemeProvider;
