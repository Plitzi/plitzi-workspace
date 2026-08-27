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
 * Module-level and singular on purpose: a browser tab paints one surface. What varies WITHIN it is `areas`, which
 * is a map rather than a second store for the same reason — two stores would need somebody to keep them in step,
 * and "keeping them in step" is the whole of what an area's rule is.
 */
const themeStore = createStore<ThemeState>(createThemeState(), { id: 'theme' });

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
export const setThemeMode = (mode: Theme): void => {
  themeStore.batch(() => {
    themeStore.setState('mode', mode);
    themeStore.setState('areas', {});
  });
};

export const setAreaTheme = (area: string, mode: Theme): void => {
  themeStore.setState(`areas.${area}`, mode);
};

/** What the machine is asking for. Written only by {@link ThemeProvider}, which is the one subscriber to it. */
export const setMachineScheme = (scheme: ColorScheme): void => {
  themeStore.setState('scheme', scheme);
};

export default themeStore;
