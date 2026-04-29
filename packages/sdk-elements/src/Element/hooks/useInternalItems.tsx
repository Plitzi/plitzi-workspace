import { get } from '@plitzi/plitzi-ui/helpers';
import { isValidElement, use, useMemo, useSyncExternalStore } from 'react';

import { usePlitziServiceContext } from '@plitzi/sdk-shared';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import pluginSelector from '../helpers/pluginSelector';
import ServerStaticShell from '../ServerStaticShell';

import type { Element, ElementLayout, CommonState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const isServer = typeof window === 'undefined';

const storeSubscriber = () => () => {};
const snapshot = () => true;
const serverSnapshot = () => false;

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
  const { useStore } = createStoreHook<CommonState>();
  const [[flat, rscEnabled]] = useStore(['schema.flat', 'schema.rsc.enabled'], { mode: 'mount' });
  const { components } = use(ComponentContext);
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { plugins } = use(PluginsContext);
  const { items } = definition;
  const hasItems = plitziElementLayout || children || items?.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/purity
  const layoutKeyIdentifier = useMemo(() => Math.round(Date.now()), [plitziElementLayout]);

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

        // In preview mode on the client, freeze server-runtime elements as static HTML.
        // RootElement adds data-plitzi-id to the server-rendered root so ServerStaticShell
        // can locate it. The plugin is never mounted; no useEffect runs.
        if (rscEnabled && runtime === 'server' && !isServer && previewMode) {
          return <ServerStaticShell key={itemId} id={itemId} />;
        }

        return pluginSelector({
          key: !previewMode && plitziElementLayout ? `${itemId}_${layoutKeyIdentifier}` : itemId,
          plitziElementLayout,
          type,
          internalProps: { id: itemId, rootId: finalRootId },
          components: components.current,
          plugins
        });
      });

    // Process Layout
    if (plitziElementLayout) {
      const { containerId, bodyChildren } = plitziElementLayout;
      if (containerId === id) {
        itemsParsed.push(bodyChildren);
      }
    }

    // Process Children
    if (children && isValidElement(children)) {
      if (Array.isArray(children)) {
        itemsParsed.push(...children);
      } else {
        itemsParsed.push(children);
      }
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
