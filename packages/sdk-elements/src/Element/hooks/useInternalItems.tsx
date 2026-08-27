import { get } from '@plitzi/plitzi-ui/helpers';
import { isValidElement, use, useMemo, useRef, useSyncExternalStore } from 'react';

import { usePlitziServiceContext } from '@plitzi/sdk-shared';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import pluginSelector, { getRemoteSettings } from '../helpers/pluginSelector';
import ServerStaticShell from '../ServerStaticShell';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const isServer = typeof window === 'undefined';

const storeSubscriber = () => () => {};
// Typed `boolean` rather than left to infer `true`/`false`: what these mean is "hydrating or not", and a literal
// type turns every later reading of it into a condition the compiler believes it already knows the answer to.
const snapshot = (): boolean => true;
const serverSnapshot = (): boolean => false;

const useInternalItems = ({
  id,
  definition,
  plitziElementLayout,
  children,
  previewMode
}: {
  id: string;
  definition: Element['definition'];
  plitziElementLayout?: ElementLayout;
  children: ReactNode | ReactNode[];
  previewMode?: boolean;
}) => {
  // `rsc.enabled`, not `schema.rsc.enabled`: the schema flag alone is also true on a client-only render, where there
  // is no server HTML to freeze a server element against and it would be dropped altogether.
  const [[flat, rscEnabled]] = useCommonStore(['schema.flat', 'rsc.enabled'], { mode: 'mount' });
  const { components } = use(ComponentContext);
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { plugins } = use(PluginsContext);
  const { items } = definition;
  const hasItems = plitziElementLayout || children || items?.length;
  // Bump a deterministic version whenever the layout instance changes so layout items remount (resetting their
  // internal state). Derived during render from the previous prop — idempotent on re-render and StrictMode-safe.
  const prevLayoutRef = useRef(plitziElementLayout);
  const layoutVersionRef = useRef(0);
  if (prevLayoutRef.current !== plitziElementLayout) {
    prevLayoutRef.current = plitziElementLayout;
    layoutVersionRef.current += 1;
  }

  const layoutKeyIdentifier = layoutVersionRef.current;

  // useSyncExternalStore with getServerSnapshot: React uses the server snapshot during
  // hydration (false → client elements excluded, matching server HTML), then transitions
  // to the client snapshot (true) synchronously before the browser paints — no flicker.
  const mounted = useSyncExternalStore(storeSubscriber, snapshot, serverSnapshot);

  return useMemo<ReactNode | undefined>(() => {
    if (!hasItems) {
      return undefined;
    }

    // Process items
    const itemsParsed: ReactNode[] = (items ?? [])
      .filter(itemId => {
        const el = flat[itemId] as Element | undefined;
        if (!el) {
          return false;
        }

        if (!previewMode || !rscEnabled) {
          return true;
        }

        const runtime = el.definition.runtime ?? 'shared';
        if (!mounted && runtime === 'client') {
          return false;
        }

        return true;
      })
      .map(itemId => {
        const { rootId, type, runtime } = get(flat, `${itemId}.definition`, {}) as Element['definition'];
        const finalRootId = get(plitziElementLayout, 'rootId', rootId);

        /**
         * Whether this browser can render the element itself.
         *
         * Everything the SDK ships can; a plugin registered only on the server cannot, and for that one the server's
         * markup is the only thing there is. Asked rather than assumed, because the answer decides whether a server
         * element stays frozen for the life of the page or only until hydration is over.
         */
        // The registry's type promises a component for every key; only asking it what it HOLDS tells the truth.
        const renderable = type in components.current || !!getRemoteSettings({ type, plugins });

        const item = pluginSelector({
          key: !previewMode && plitziElementLayout ? `${itemId}_${layoutKeyIdentifier}` : itemId,
          plitziElementLayout,
          type,
          internalProps: { id: itemId, rootId: finalRootId },
          components: components.current,
          plugins
        });

        /**
         * A server element is frozen for HYDRATION, and then only for as long as it has to be.
         *
         * React must be handed exactly the markup the server sent, so the first client render replays it from the
         * DOM — `RootElement` marks the server-rendered root with `data-rsc-id` for the shell to find. That is what
         * `mounted` is: false while hydrating, true on the render right after, before the browser paints.
         *
         * Staying frozen after that was the mistake, and it was a big one. Frozen markup is not React's, so nothing
         * inside it has a handler: a pager under a server-driven provider did nothing, the provider's own
         * `loadMore` / `goToPage` / `writeRecord` could never fire, and a route change onto a page whose server
         * markup this document never carried rendered an empty section. What keeps a credential on the server is
         * `getRscData` running there — not whether the browser mounts what it already has the data for.
         *
         * So the element takes over once hydration is done, rendering from the same payload the server used. The
         * exception is the element this browser has no component for, which has nothing to take over with.
         */
        if (rscEnabled && runtime === 'server' && !isServer && previewMode && !(mounted && renderable)) {
          return (
            <ServerStaticShell key={itemId} id={itemId}>
              {item}
            </ServerStaticShell>
          );
        }

        return item;
      });

    // Process Layout
    if (plitziElementLayout) {
      const { containerId, bodyChildren } = plitziElementLayout;
      if (containerId === id) {
        itemsParsed.push(bodyChildren);
      }
    }

    // Process Children
    if (Array.isArray(children)) {
      itemsParsed.push(...children.filter(isValidElement));
    } else if (isValidElement(children)) {
      itemsParsed.push(children);
    }

    if (!items) {
      return undefined;
    }

    return itemsParsed.length === 1 ? itemsParsed[0] : itemsParsed;
  }, [
    hasItems,
    items,
    plitziElementLayout,
    children,
    flat,
    previewMode,
    rscEnabled,
    mounted,
    layoutKeyIdentifier,
    components,
    plugins,
    id
  ]);
};

export default useInternalItems;
