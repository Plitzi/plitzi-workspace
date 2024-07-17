// Packages
import React, { isValidElement, useMemo } from 'react';
import get from 'lodash/get';

// Relatives
import PluginManager from '../PluginManager';
import { PARTIAL_SCHEMA_TYPE_SEGMENT } from '../ElementConstants';

const useInternalItems = props => {
  const { internalProps, schema, children, SchemaContext, prevSchema, newSchema, previewMode } = props;
  const { id, definition, plitziElementLayout } = internalProps;
  const { items } = definition;
  const layoutKeyIdentifier = useMemo(() => Math.round(Math.random() * 100), [plitziElementLayout]);

  return useMemo(() => {
    if (!plitziElementLayout && !children && (!items || items.length === 0)) {
      return undefined;
    }

    // Process items
    const flat = get(schema, 'flat', {});
    const itemsParsed = (items ?? [])
      .filter(itemId => !!flat[itemId])
      .map(itemId => {
        const { rootId, type } = get(flat, `${itemId}.definition`, {});
        const finalRootId = get(plitziElementLayout, 'rootId', rootId);

        return (
          <PluginManager
            key={!previewMode && plitziElementLayout ? `${itemId}_${layoutKeyIdentifier}` : itemId}
            id={itemId}
            rootId={finalRootId}
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
      plitziElementLayout.type === PARTIAL_SCHEMA_TYPE_SEGMENT &&
      plitziElementLayout?.containerId === id &&
      prevSchema
    ) {
      return (
        <SchemaContext value={newSchema}>{itemsParsed?.length === 1 ? itemsParsed[0] : itemsParsed}</SchemaContext>
      );
    }

    // Output
    if (itemsParsed.length === 1) {
      return itemsParsed[0];
    }

    return itemsParsed;
  }, [
    children,
    items,
    plitziElementLayout,
    previewMode,
    layoutKeyIdentifier,
    id,
    definition,
    schema,
    prevSchema,
    newSchema
  ]);
};

export default useInternalItems;
