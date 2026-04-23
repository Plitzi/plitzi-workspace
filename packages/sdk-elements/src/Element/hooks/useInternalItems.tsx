import { get } from '@plitzi/plitzi-ui/helpers';
import { isValidElement, use, useMemo } from 'react';

import { usePlitziServiceContext } from '@plitzi/sdk-shared';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import pluginSelector from '../helpers/pluginSelector';
// import PluginManager from '../PluginManager';

import type { Element, ElementLayout, CommonState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

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
  const [flat] = useStore('schema.flat', { mode: 'mount' });
  const { components } = use(ComponentContext);
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { plugins } = use(PluginsContext);

  const { items } = definition;
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/purity
  const layoutKeyIdentifier = useMemo(() => Math.round(Date.now()), [plitziElementLayout]);

  return useMemo<ReactNode | undefined>(() => {
    if (!plitziElementLayout && !children && (!items || items.length === 0)) {
      return undefined;
    }

    const isServer = typeof window === 'undefined';

    // Process items
    const itemsParsed: ReactNode[] = (items ?? [])
      .filter(itemId => {
        const el = flat[itemId] as Element | undefined;
        if (!el) return false;
        // In the builder (!previewMode) every element must be visible so it can be configured.
        if (!previewMode) return true;
        const runtime = el.definition.runtime ?? 'shared';
        // During SSR, skip client-only elements.
        if (isServer && runtime === 'client') return false;

        return true;
      })
      .map(itemId => {
        const { rootId, type } = get(flat, `${itemId}.definition`, {}) as Element['definition'];
        const finalRootId = get(plitziElementLayout, 'rootId', rootId);

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
  }, [plitziElementLayout, children, items, id, flat, previewMode, layoutKeyIdentifier, components, plugins]);
};

export default useInternalItems;
