import { use, useMemo, useSyncExternalStore } from 'react';

import themeStore, { startingThemeState } from './themeStore';
import { sharedContext } from '../helpers/sharedContext';

import type { ThemeStoreInstance } from './themeStore';
import type { Theme, ThemeState } from '../types';

/**
 * Which theme store the tree under here reads.
 *
 * Absent — the ordinary case — means the surface's own, the module-level singleton. It is only ever provided by a
 * `ThemeProvider` running in `container` scope: an SDK embedded in an application that has a theme of its own, where
 * "the surface" is the application and not the space inside it. Two SDK instances in one document (the desktop
 * window renders its shell as a space AND the space the visitor opened) is exactly the case the singleton cannot
 * serve on its own — whichever mounted last would be answering for both.
 *
 * Deliberately NOT the way ordinary consumers reach the theme: a panel in a shadow root and an editor in a portal
 * are under no provider at all, and they still have to get an answer. That is what the fall-through is for.
 */
const ThemeScopeContext = sharedContext<ThemeStoreInstance | undefined>('ThemeScopeContext', undefined);

export const useThemeStore = (): ThemeStoreInstance => use(ThemeScopeContext) ?? themeStore;

export default ThemeScopeContext;

/**
 * The mode the surface under a `ThemeProvider` starts in: the theme its host supplied — the cookie a server read — or
 * else its default.
 *
 * For the render that runs before any effect can: the server's, and the hydration that has to agree with it. The
 * provider sets the store from a layout effect, which never runs on a server — so the page was rendered from the
 * store's own starting state, `system` resolving to `light`, whatever the cookie said. The class on `<html>` was right
 * and `{{ theme.resolved }}` was not: a picture whose address names the scheme was the light one, swapped for the dark
 * one as the page hydrated.
 */
export const ThemeStartContext = sharedContext<Theme | undefined>('ThemeStartContext', undefined);

/**
 * The theme store's state, as the server rendered it until the surface is live.
 *
 * The starting state is the server snapshot, so the server renders with it and the hydration reads the same — it is
 * never written into the store there, which on a server is one module-level singleton every request shares. Once
 * hydrated, the store answers, which the provider has set by then.
 */
export const useThemeState = (store: ThemeStoreInstance): ThemeState => {
  const start = use(ThemeStartContext);
  const startingState = useMemo(() => (start === undefined ? undefined : startingThemeState(start)), [start]);

  return useSyncExternalStore(store.subscribe, store.getState, () => startingState ?? store.getState());
};
