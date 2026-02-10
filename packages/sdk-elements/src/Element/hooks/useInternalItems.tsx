import get from 'lodash-es/get.js';
import { isValidElement, useMemo } from 'react';

import PluginManager from '../PluginManager';

import type { Element, Schema, SchemaContextValue, ElementLayout } from '@plitzi/sdk-shared';
import type { Context, ReactNode } from 'react';

const useInternalItems = ({
  id,
  definition,
  plitziElementLayout,
  schema,
  children,
  SchemaContext,
  prevSchema,
  newSchema,
  previewMode
}: {
  id: string;
  definition: Element['definition'];
  plitziElementLayout?: ElementLayout;
  schema: Schema;
  children: ReactNode | ReactNode[];
  SchemaContext: Context<SchemaContextValue>;
  prevSchema?: Schema;
  newSchema: Schema; // SchemaContextValue;
  previewMode?: boolean;
}) => {
  const { items } = definition;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layoutKeyIdentifier = useMemo(() => Math.round(Math.random() * 100), [plitziElementLayout]);
  const newSchemaContext = useMemo(() => (prevSchema ? { schema: newSchema } : undefined), [newSchema, prevSchema]);

  return useMemo<ReactNode | undefined>(() => {
    if (!plitziElementLayout && !children && (!items || items.length === 0)) {
      return undefined;
    }

    // Process items
    const flat = get(schema, 'flat', {}) as Schema['flat'];
    const itemsParsed: ReactNode[] = (items ?? [])
      .filter(itemId => !!(flat[itemId] as Element | undefined))
      .map(itemId => {
        const { rootId, type } = get(flat, `${itemId}.definition`, {}) as Element['definition'];
        const finalRootId = get(plitziElementLayout, 'rootId', rootId);

        return (
          <PluginManager
            key={!previewMode && plitziElementLayout ? `${itemId}_${layoutKeyIdentifier}` : itemId}
            internalProps={{ id: itemId, rootId: finalRootId }}
            plitziElementLayout={plitziElementLayout}
            type={type}
          />
        );
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
      itemsParsed.push(...children);
    } else if (children && isValidElement(children)) {
      itemsParsed.push(children);
    }

    if (
      plitziElementLayout &&
      plitziElementLayout.type === 'segment' &&
      plitziElementLayout.containerId === id &&
      prevSchema &&
      newSchemaContext
    ) {
      return (
        <SchemaContext value={newSchemaContext}>
          {itemsParsed.length === 1 ? itemsParsed[0] : itemsParsed}
        </SchemaContext>
      );
    }

    return itemsParsed.length === 1 ? itemsParsed[0] : itemsParsed;
  }, [
    plitziElementLayout,
    children,
    items,
    schema,
    id,
    prevSchema,
    previewMode,
    layoutKeyIdentifier,
    SchemaContext,
    newSchemaContext
  ]);
};

export default useInternalItems;
