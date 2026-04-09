export type Theme = 'dark' | 'light' | 'system';

export type ThemeContextValue = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};
