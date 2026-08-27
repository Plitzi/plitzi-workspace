import { useCallback, useMemo, useSyncExternalStore } from 'react';

import themeStore, { resolveScheme, setAreaTheme, setThemeMode, themeFor } from './themeStore';

import type { ThemeValue } from '../types';

/**
 * The area every surface that paints the SPACE uses — the builder's canvas, and every `BuilderAreaPreview`: the
 * page thumbnails, a template preview, what the agent renders in the chat.
 *
 * ONE area and not one per surface, on purpose. They are all showing the same thing, and a preview of a page that
 * paints in a different scheme from the canvas beside it is not a preview of anything. What the split is actually
 * for is the EDITOR versus the space it is editing: the panels, menus and dialogs follow the surface theme, and
 * this follows whichever scheme the author wants to look at their page in.
 *
 * Named rather than typed at each call site so there is one string to change and nowhere for a typo to hide — a
 * misspelled area does not fail, it silently makes a second one that follows the surface.
 */
export const SPACE_THEME_AREA = 'canvas';

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
