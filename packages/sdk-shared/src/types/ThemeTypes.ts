export type Theme = 'dark' | 'light' | 'system';

export type ThemeContextValue = {
  theme: Theme;
  /** `system` gives the machine back the decision; the other two are the visitor overruling it. */
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};
