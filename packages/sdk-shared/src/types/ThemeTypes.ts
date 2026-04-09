export type Theme = 'dark' | 'light' | 'system';

export type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};
