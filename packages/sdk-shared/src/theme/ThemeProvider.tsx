import { useEffect, useSyncExternalStore } from 'react';

import { useIsomorphicLayoutEffect } from '@plitzi/nexus/react';

import { applyThemeClass, THEME_STORAGE_KEY } from './themeBoot';
import themeStore, { resolveScheme, setAreaTheme, setMachineScheme, setThemeMode } from './themeStore';
import { useCommonStoreSync } from '../store';

import type { ColorScheme, Theme } from '../types';
import type { ReactNode } from 'react';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEMES: Theme[] = ['dark', 'light', 'system'];

export type ThemeProviderProps = {
  defaultTheme?: Theme;
  /**
   * The theme the host already knows, when it knows one.
   *
   * A host that keeps the choice somewhere its server can read — a cookie, the account — renders the class itself
   * and passes the value here, and nothing is read from storage at all. That is the one arrangement with no window
   * of wrongness anywhere: the document arrives correct and the provider agrees with it from its first render.
   *
   * Left out, the choice is read from storage on mount, and the document should run {@link themeBootScript} so the
   * paint before that mount is not the other theme.
   */
  theme?: Theme;
  storageKey?: string;
  storageType?: 'localStorage' | 'sessionStorage';
  children?: ReactNode;
};

const storageFor = (storageType: ThemeProviderProps['storageType']): Storage | undefined => {
  try {
    return storageType === 'sessionStorage' ? window.sessionStorage : window.localStorage;
  } catch {
    // A sandboxed iframe or a privacy mode that throws on access rather than answering undefined. The theme still
    // works; it just stops being remembered.
    return undefined;
  }
};

const readStored = (storageKey: string, storageType: ThemeProviderProps['storageType']): Theme | undefined => {
  const stored = storageFor(storageType)?.getItem(storageKey) ?? undefined;

  return THEMES.includes(stored as Theme) ? (stored as Theme) : undefined;
};

const readStoredAreas = (storageKey: string, storageType: ThemeProviderProps['storageType']): Record<string, Theme> => {
  const stored = storageFor(storageType)?.getItem(`${storageKey}.areas`);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;

    return Object.entries(parsed).reduce<Record<string, Theme>>((acum, [area, mode]) => {
      if (THEMES.includes(mode as Theme)) {
        acum[area] = mode as Theme;
      }

      return acum;
    }, {});
  } catch {
    return {};
  }
};

const machineScheme = (): ColorScheme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light');

/**
 * Drives the theme store: what was remembered, what the machine is asking for, and what the document says.
 *
 * It provides nothing. The theme lives in `themeStore` and every consumer reads it with `useTheme`, so a panel in a
 * shadow root or an editor in a portal gets the same answer as a component under this element. What is left here is
 * the three things only a mounted component can do — read storage once, subscribe to `matchMedia`, and stamp the
 * root — and doing them in ONE place is the point: a component running its own `matchMedia` gets a value that stops
 * updating the moment the visitor changes their system setting, which is how a panel ends up dark inside a page
 * that is still light.
 */
const ThemeProvider = ({
  defaultTheme = 'dark',
  theme,
  storageKey = THEME_STORAGE_KEY,
  storageType = 'localStorage',
  children
}: ThemeProviderProps) => {
  /**
   * What was remembered, read before the first paint — and in a LAYOUT effect rather than during the render.
   *
   * The store is a module-level singleton, so writing to it while rendering updates every component already
   * subscribed to it, which is a setState from inside another component's render. React says so, and it is not
   * pedantry: mount a second surface (the harness re-rendering a space under a new `key`, a preview pane opening
   * beside an editor) and the provider coming up notifies the tree on its way out.
   *
   * A layout effect keeps what the render-phase version was for. It runs after the commit but BEFORE the browser
   * paints, so the one frame in the default theme is never on screen — which is the flash this reads storage to
   * avoid — and by then every subscriber is mounted and a wake is an ordinary update.
   */
  useIsomorphicLayoutEffect(() => {
    themeStore.batch(() => {
      setMachineScheme(machineScheme());
      // `setThemeMode` clears the areas by design, so what was remembered for them is restored after it, never before.
      // A theme the host supplied wins over storage: it is the value the document was already rendered with, and
      // reading a stale key over it would produce the very correction this exists to avoid.
      setThemeMode(theme ?? readStored(storageKey, storageType) ?? defaultTheme);
      Object.entries(readStoredAreas(storageKey, storageType)).forEach(([area, mode]) => setAreaTheme(area, mode));
    });
  }, [defaultTheme, theme, storageKey, storageType]);

  /**
   * Published into the app store, where everything else about this render already lives.
   *
   * A MIRROR: `themeStore` stays the source, because a panel in a shadow root or an editor in a portal has to be
   * able to read the theme without being under any provider, and no app store can serve that. What this buys is
   * everything the app store is good at — `{{ theme.resolved }}` in a binding, a `when` rule that switches on the
   * scheme, and one line in the devtools store viewer that answers "which theme is this" without opening code.
   */
  const state = useSyncExternalStore(themeStore.subscribe, themeStore.getState, themeStore.getState);
  useCommonStoreSync(
    ['theme.mode', 'theme.resolved', 'theme.areas'],
    [state.mode, resolveScheme(state.mode, state.scheme), state.areas]
  );

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setMachineScheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    onChange();

    return () => query.removeEventListener('change', onChange);
  }, []);

  /**
   * The root carries the CHOICE, and only when there is one.
   *
   * `system` writes no class at all, which is what lets the stylesheet's `prefers-color-scheme` queries answer —
   * they are guarded on the absence of these classes, so a class present is a visitor overruling their machine.
   * Writing `light` explicitly matters as much as writing `dark`: removing a class cannot express "I want light on
   * a machine set to dark".
   *
   * Remembering happens here too, in the same pass, because they answer the same event: the surface changed its
   * mind. Areas are kept beside it rather than inside it, so the key a deployment already has keeps holding the one
   * plain word it always held.
   */
  useEffect(() => {
    const apply = () => {
      const { mode, areas } = themeStore.getState();
      const storage = storageFor(storageType);
      storage?.setItem(storageKey, mode);
      storage?.setItem(`${storageKey}.areas`, JSON.stringify(areas));
      applyThemeClass(mode, document.documentElement);
    };
    apply();

    return themeStore.subscribe(apply);
  }, [storageKey, storageType]);

  return children;
};

export default ThemeProvider;
