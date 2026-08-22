export type Theme = 'dark' | 'light' | 'system';

/**
 * The answer, once `system` has been put to the machine: what is actually on screen.
 *
 * Every consumer that paints something wants this one — a code editor, a chart, the dev-tools panel. `theme` is
 * the CHOICE and can be `system`, which is not a colour and cannot be compared against one.
 */
export type ColorScheme = Exclude<Theme, 'system'>;

export type ThemeContextValue = {
  theme: Theme;
  /** `theme` with `system` already resolved, and kept in step when the machine changes its mind. */
  resolvedTheme: ColorScheme;
  /** `system` gives the machine back the decision; the other two are the visitor overruling it. */
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};
