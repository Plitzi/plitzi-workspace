import { use, useEffect, useId, useState, useSyncExternalStore } from 'react';

import { StoreContext, useIsomorphicLayoutEffect } from '@plitzi/nexus/react';

import { applyThemeClass, readThemeCookie, THEME_COOKIE_NAME, writeThemeCookie } from './themeCookie';
import ThemeScopeContext from './ThemeScope';
import defaultThemeStore, { createThemeStore, resolveScheme, setMachineScheme, setThemeMode } from './themeStore';
import { useCommonStoreSync } from '../store';

import type { ColorScheme, Theme, ThemeState } from '../types';
import type { ReactNode } from 'react';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Whose theme this provider is running.
 *
 * `document` — the default — is a surface that IS the page: it stamps the class on `<html>`, and everything in the
 * document follows it. `container` is the SDK EMBEDDED in an application that has a theme of its own: it touches
 * nothing outside itself, gets a theme store of its own, and hands the class back through `useTheme` for the app's
 * own root element to wear.
 *
 * The desktop window is why this exists. It renders its chrome in Tailwind's `dark:` variants off the document
 * class and mounts the SDK twice inside it — once for the rail, once for the space the visitor opened — so a
 * visitor toggling the theme of THEIR space was repainting the application around it.
 */
export type ThemeScope = 'document' | 'container';

export type ThemeProviderProps = {
  defaultTheme?: Theme;
  /**
   * The theme the host already knows.
   *
   * The server-rendered case: the choice is in the cookie, the server read it, rendered the class and passes the
   * value here — so the document arrives correct and the provider agrees with it from its first render. Left out,
   * the cookie is read here instead, which is what a surface no server rendered does.
   */
  theme?: Theme;
  scope?: ThemeScope;
  /** The cookie the choice lives in. Named per surface where two share an origin — the builder and a space do. */
  cookieName?: string;
  children?: ReactNode;
};

const machineScheme = (): ColorScheme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light');

/**
 * The theme, published into the app store where everything else about this render already lives.
 *
 * A MIRROR: the theme store stays the source, because a panel in a shadow root or an editor in a portal has to be
 * able to read the theme without being under any provider, and no app store can serve that. What this buys is
 * everything the app store is good at — `{{ theme.resolved }}` in a binding, a `when` rule that switches on the
 * scheme, and one line in the devtools store viewer that answers "which theme is this" without opening code.
 */
const ThemeMirror = ({ state }: { state: ThemeState }) => {
  useCommonStoreSync(
    ['theme.mode', 'theme.resolved', 'theme.areas'],
    [state.mode, resolveScheme(state.mode, state.scheme), state.areas]
  );

  return null;
};

/**
 * Drives the theme store: what was chosen, what the machine is asking for, and what the document says.
 *
 * It provides no VALUE. The theme lives in a store and every consumer reads it with `useTheme`, so a panel in a
 * shadow root or an editor in a portal gets the same answer as a component under this element. What is left here is
 * the three things only a mounted component can do — read the cookie once, subscribe to `matchMedia`, and stamp the
 * root — and doing them in ONE place is the point: a component running its own `matchMedia` gets a value that stops
 * updating the moment the visitor changes their system setting, which is how a panel ends up dark inside a page
 * that is still light.
 */
const ThemeProvider = ({
  defaultTheme = 'dark',
  theme,
  scope = 'document',
  cookieName = THEME_COOKIE_NAME,
  children
}: ThemeProviderProps) => {
  const scoped = scope === 'container';
  const scopeId = useId();
  // Created once per mounted provider, and only when this surface is not the document's. `useState`'s initialiser
  // rather than `useMemo`, because a store rebuilt on a re-render would drop every subscriber attached to the old
  // one. The id comes from `useId` so the dev-tools registry names it the same on the server and in the browser.
  const [ownStore] = useState(() => (scoped ? createThemeStore(`theme${scopeId}`) : undefined));
  const store = ownStore ?? defaultThemeStore;

  /**
   * What was chosen, read before the first paint — and in a LAYOUT effect rather than during the render.
   *
   * The store may be a module-level singleton, so writing to it while rendering updates every component already
   * subscribed to it, which is a setState from inside another component's render. React says so, and it is not
   * pedantry: mount a second surface (the harness re-rendering a space under a new `key`, a preview pane opening
   * beside an editor) and the provider coming up notifies the tree on its way out.
   *
   * A layout effect runs after the commit but BEFORE the browser paints, so the one frame in the default theme is
   * never on screen, and by then every subscriber is mounted and a wake is an ordinary update.
   *
   * A theme the host supplied wins: it is the value the document was already rendered with, and reading the cookie
   * over it would produce the very correction this exists to avoid.
   *
   * An embedded surface reads no cookie at all, for the same reason it writes none: the one on this origin belongs
   * to the page around it — or, on `localhost`, to whichever other app on another port wrote it last. Starting from
   * it is how a space came up dark inside a desktop window that was light.
   */
  useIsomorphicLayoutEffect(() => {
    const chosen = scoped ? undefined : readThemeCookie(cookieName);
    store.batch(() => {
      setMachineScheme(machineScheme(), store);
      setThemeMode(theme ?? chosen ?? defaultTheme, store);
    });
  }, [defaultTheme, theme, cookieName, scoped, store]);

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  // A host application can mount this with no Plitzi store anywhere above it — the desktop window does, to own the
  // theme of its own chrome — and there is nothing to mirror into there. A component rather than an `enabled` flag
  // because the sync hook resolves its store before it reads any option, so not calling it is the only way out.
  const hasAppStore = use(StoreContext) !== undefined;

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setMachineScheme(query.matches ? 'dark' : 'light', store);
    query.addEventListener('change', onChange);
    onChange();

    return () => query.removeEventListener('change', onChange);
  }, [store]);

  /**
   * The choice, written down and put on the document — the two halves of the same event.
   *
   * `system` writes no class at all, which is what lets the stylesheet's `prefers-color-scheme` queries answer: a
   * class present is a visitor overruling their machine.
   *
   * An embedded surface stamps nothing and remembers nothing. The document belongs to the application around it —
   * what wears the class there is that application's own root element, from `useTheme` — and the cookie belongs to
   * whichever surface owns the origin, which is not this one. Areas are not written either, here or anywhere: they
   * are an override of what the surface is CURRENTLY showing, and `setThemeMode` clears them whenever it changes.
   */
  useEffect(() => {
    if (scoped) {
      return undefined;
    }

    const apply = () => {
      const { mode } = store.getState();
      writeThemeCookie(mode, cookieName);
      applyThemeClass(mode, document.documentElement);
    };
    apply();

    return store.subscribe(apply);
  }, [cookieName, scoped, store]);

  const mirror = hasAppStore ? <ThemeMirror state={state} /> : null;

  if (!scoped) {
    return (
      <>
        {mirror}
        {children}
      </>
    );
  }

  return (
    <ThemeScopeContext value={ownStore}>
      {mirror}
      {children}
    </ThemeScopeContext>
  );
};

export default ThemeProvider;
