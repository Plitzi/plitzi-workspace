import { createContext, use } from 'react';

import themeStore from './themeStore';

import type { ThemeStoreInstance } from './themeStore';

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
const ThemeScopeContext = createContext<ThemeStoreInstance | undefined>(undefined);

export const useThemeStore = (): ThemeStoreInstance => use(ThemeScopeContext) ?? themeStore;

export default ThemeScopeContext;
