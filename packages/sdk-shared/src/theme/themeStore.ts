import { createStore } from '@plitzi/nexus';

import type { ColorScheme, Theme, ThemeState } from '../types';

export const createThemeState = (): ThemeState => ({ mode: 'system', scheme: 'light', areas: {} });

/**
 * The theme, as a store rather than a context.
 *
 * It is read by things that render outside the app's provider tree — the dev-tools panel in its shadow root, an
 * editor mounted into a portal — and by the odd module that has no component around it at all. A context could
 * serve neither, and every consumer that wanted the answer had to be under the one provider that held it.
 *
 * What varies WITHIN a surface is `areas`, which is a map rather than a second store for the same reason — two
 * stores would need somebody to keep them in step, and "keeping them in step" is the whole of what an area's rule
 * is.
 */
export const createThemeStore = (id = 'theme') => createStore<ThemeState>(createThemeState(), { id });

export type ThemeStoreInstance = ReturnType<typeof createThemeStore>;

/**
 * The surface's theme.
 *
 * A browser tab usually paints one surface, and this is it — what the dev-tools panel and anything else outside a
 * provider tree reads. It stops being the only one when a page EMBEDS the SDK in an application that has a theme of
 * its own (the desktop window, a space mounted in a host): there the embedded surface gets a store of its own from
 * {@link createThemeStore} and this one keeps belonging to the application around it. See `ThemeProvider`'s `scope`.
 */
const themeStore = createThemeStore();

export const resolveScheme = (mode: Theme, scheme: ColorScheme): ColorScheme => (mode === 'system' ? scheme : mode);

/** The theme of one area, or of the surface when the area has made no choice of its own. */
export const themeFor = (state: ThemeState, area?: string): Theme =>
  (area ? state.areas[area] : undefined) ?? state.mode;

/**
 * The surface's own choice — and, with it, every area's.
 *
 * Clearing `areas` IS the sync rule: an area's theme is an override of what the surface is currently showing, so
 * the moment the surface changes its mind there is nothing left to override. Without this an author who darkened
 * the preview pane once would find it stuck there for good, deaf to the editor's toggle, which is the complaint
 * that a separate per-area setting always produces.
 */
export const setThemeMode = (mode: Theme, store: ThemeStoreInstance = themeStore): void => {
  store.batch(() => {
    store.setState('mode', mode);
    store.setState('areas', {});
  });
};

export const setAreaTheme = (area: string, mode: Theme, store: ThemeStoreInstance = themeStore): void => {
  store.setState(`areas.${area}`, mode);
};

/** What the machine is asking for. Written only by `ThemeProvider`, which is the one subscriber to it. */
export const setMachineScheme = (scheme: ColorScheme, store: ThemeStoreInstance = themeStore): void => {
  store.setState('scheme', scheme);
};

export default themeStore;
