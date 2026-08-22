import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { createContext, useCallback, useEffect, useMemo } from 'react';

import type { Theme, ThemeContextValue } from '../types';
import type { ReactNode } from 'react';

const ThemeContext = createContext<ThemeContextValue>({ theme: 'system', setTheme: () => {}, toggleTheme: () => {} });
ThemeContext.displayName = 'ThemeContext';

export type ThemeProviderProps = {
  defaultTheme?: Theme;
  storageKey?: string;
  storageType?: 'localStorage' | 'sessionStorage';
  children?: ReactNode;
};

/** What the operating system is asking for, right now. */
const systemTheme = (): Exclude<Theme, 'system'> =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const ThemeProvider = ({
  defaultTheme = 'dark',
  storageKey = 'theme',
  storageType = 'localStorage',
  children
}: ThemeProviderProps) => {
  const [themeMode, setThemeMode] = useStorage<Theme>(storageKey, defaultTheme, storageType);

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

  /** From `system`, a toggle means "the opposite of what I am looking at" — the machine's answer, flipped. */
  const toggleTheme = useCallback(() => {
    setThemeMode(prev => ((prev === 'system' ? systemTheme() : prev) === 'dark' ? 'light' : 'dark'));
  }, [setThemeMode]);

  const themeValue = useMemo(
    () => ({ theme: themeMode, setTheme: setThemeMode, toggleTheme }),
    [themeMode, setThemeMode, toggleTheme]
  );

  return <ThemeContext value={themeValue}>{children}</ThemeContext>;
};

export { ThemeContext };

export default ThemeProvider;
