import type { Theme } from '../../types';

const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
};

export default getSystemTheme;
