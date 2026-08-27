export type Theme = 'dark' | 'light' | 'system';

/**
 * The answer, once `system` has been put to the machine: what is actually on screen.
 *
 * Every consumer that paints something wants this one — a code editor, a chart, the dev-tools panel. `theme` is
 * the CHOICE and can be `system`, which is not a colour and cannot be compared against one.
 */
export type ColorScheme = Exclude<Theme, 'system'>;

/**
 * The whole of what anybody knows about the theme, in one store.
 *
 * `scheme` is the machine's own answer, kept live by {@link ThemeProvider} — the only place that talks to
 * `matchMedia`, so no two components can disagree about it during the frame after the visitor changes their system
 * setting.
 *
 * `areas` is for a surface that paints more than one thing: the builder's canvas and its preview pane each get to
 * be dark while the editor around them is light. An area with no entry FOLLOWS `mode`, and choosing a surface theme
 * empties the map — an area's choice is an override of the current one, never a permanent divorce from it.
 */
export type ThemeState = {
  mode: Theme;
  scheme: ColorScheme;
  areas: Record<string, Theme>;
};

export type ThemeValue = {
  theme: Theme;
  /** `theme` with `system` already resolved, and kept in step when the machine changes its mind. */
  resolvedTheme: ColorScheme;
  /** `system` gives the machine back the decision; the other two are the visitor overruling it. */
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};
