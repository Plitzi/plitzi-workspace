import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'nexus-theme';
const listeners = new Set<() => void>();

// The DOM class is the source of truth — an inline script in index.html sets it before React mounts (no flash), so we
// seed from whatever it resolved to.
const read = (): Theme =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark';

let current: Theme = read();

const apply = (theme: Theme): void => {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
};

export const setTheme = (theme: Theme): void => {
  if (theme === current) {
    return;
  }

  current = theme;
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage disabled — the in-memory value still drives the session.
  }

  listeners.forEach(listener => listener());
};

export const toggleTheme = (): void => setTheme(current === 'dark' ? 'light' : 'dark');

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

const getSnapshot = (): Theme => current;

const getServerSnapshot = (): Theme => 'dark';

export const useTheme = (): Theme => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
