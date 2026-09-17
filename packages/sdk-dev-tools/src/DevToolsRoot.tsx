import { ThemeContext as UiThemeContext } from '@plitzi/plitzi-ui/Provider';
import { use, useContext, useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { StoreContext } from '@plitzi/nexus/react';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import ThemeScopeContext from '@plitzi/sdk-shared/theme/ThemeScope';

import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';

export type DevToolsRootProps = {
  children: ReactNode;
};

// The host adds no box of its own, so what the panel renders is the flex item it always was.
const hostStyle = { display: 'contents' } as const;

/**
 * Renders the panel in a React root of its own, inside a node the page's root leaves alone.
 *
 * In the page's root, every render of the panel was a commit of the page: the tracing tab recorded the panel profiling
 * itself, a log arriving re-rendered through the app's scheduler, and what a tab switch cost read higher with the
 * panel open than without it. In its own root the panel's work is its own.
 *
 * The node stays where the panel always sat — the flex sibling of the space, which is how it docks and what the
 * collapsed badge positions itself against — so only the React tree moves, not the layout. What the panel reads from
 * the page's providers is carried over: the root store, plitzi-ui's theme, the theme scope, and the two plugin
 * registries.
 */
const DevToolsRoot = ({ children }: DevToolsRootProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | undefined>(undefined);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const store = useContext(StoreContext);
  const themeStore = use(ThemeScopeContext);
  const plugins = use(PluginsContext);
  const components = use(ComponentContext);
  // plitzi-ui components read their class names from here; without it every one renders unstyled.
  const uiTheme = use(UiThemeContext);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    // A cleanup followed at once by the effect again is StrictMode rehearsing a remount: the root is kept, since a
    // second `createRoot` on the same node is an error.
    clearTimeout(unmountTimer.current);
    rootRef.current ??= createRoot(host);

    return () => {
      const root = rootRef.current;
      // Unmounting a root while the page's root is committing is refused, so it waits for that commit to finish.
      unmountTimer.current = setTimeout(() => {
        root?.unmount();
        if (rootRef.current === root) {
          rootRef.current = undefined;
        }
      }, 0);
    };
  }, []);

  // Every render of the host re-renders the panel with what it is carrying — that is how a change in any of the bridged
  // providers reaches a tree that is not under them.
  useLayoutEffect(() => {
    rootRef.current?.render(
      <StoreContext value={store}>
        <UiThemeContext value={uiTheme}>
          <ThemeScopeContext value={themeStore}>
            <PluginsContext value={plugins}>
              <ComponentContext value={components}>{children}</ComponentContext>
            </PluginsContext>
          </ThemeScopeContext>
        </UiThemeContext>
      </StoreContext>
    );
  });

  return <div ref={hostRef} style={hostStyle} />;
};

export default DevToolsRoot;
