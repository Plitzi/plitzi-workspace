import { get } from '@plitzi/plitzi-ui/helpers';
import { isValidElement, use, useMemo, useState, useEffect } from 'react';

import { usePlitziServiceContext } from '@plitzi/sdk-shared';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import pluginSelector from '../helpers/pluginSelector';
import ServerStaticShell from '../ServerStaticShell';

import type { Element, ElementLayout, CommonState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const isServer = typeof window === 'undefined';

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

  // Tracks whether the component has mounted on the client.
  // Starts false so the initial client render (hydration phase) matches the server output.
  const [mounted, setMounted] = useState(!hasItems || !rscEnabled);
  useEffect(() => {
    if (hasItems && rscEnabled) {
      setMounted(true);
    }
  }, [hasItems, rscEnabled]);

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
        // Skip client-only elements on the server AND during the initial client render
        // (hydration phase). This ensures the React tree matches the server HTML so
        // hydrateRoot does not produce a mismatch. After the first effect fires (mounted=true)
        // they are included and React mounts them normally.
        if ((isServer || !mounted) && runtime === 'client') {
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
