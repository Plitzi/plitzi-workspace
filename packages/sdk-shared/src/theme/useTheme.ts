import { useCallback, useMemo, useSyncExternalStore } from 'react';

import themeStore, { resolveScheme, setAreaTheme, setThemeMode, themeFor } from './themeStore';

import type { ThemeValue } from '../types';

/**
 * The theme, for whoever is asking.
 *
 * Called bare it answers the surface's; called with an `area` it answers that area's, falling back to the surface
 * while the area has made no choice of its own. `setTheme` writes wherever it read, so a control never has to know
 * which of the two it is wired to — the builder's header toggle and the canvas's own are the same component with a
 * different argument.
 *
 * `resolvedTheme` is always a colour: `system` is resolved against the machine's live answer, which
 * {@link ThemeProvider} keeps in the store. Anything that PAINTS wants that one — a code editor, a chart, a canvas
 * — because `system` cannot be compared against a colour, and resolving it to `light` (the usual shortcut) makes a
 * dark-set machine render the light thing.
 */
const useTheme = (area?: string): ThemeValue => {
  const state = useSyncExternalStore(themeStore.subscribe, themeStore.getState, themeStore.getState);
  const theme = themeFor(state, area);
  const resolvedTheme = resolveScheme(theme, state.scheme);

  const setTheme = useCallback((mode: typeof theme) => (area ? setAreaTheme(area, mode) : setThemeMode(mode)), [area]);
  /** A toggle means "the opposite of what I am looking at", which from `system` is the machine's answer flipped. */
  const toggleTheme = useCallback(
    () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    [resolvedTheme, setTheme]
  );

  return useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );
};

export default useTheme;
