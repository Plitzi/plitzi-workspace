import { descendants } from '@plitzi/sdk-schema/helpers/elementTree';

import type { ComponentDefinition, Element, Schema } from '@plitzi/sdk-shared';

/**
 * The elements of a tree hung off `rootId` that can be a slot: those whose TYPE holds children, as its declaration
 * says. Not the element's own `items`, which an authored document gives every element, a text included.
 */
export const slotChoicesOf = (
  flat: Schema['flat'],
  rootId: Element['id'],
  definitions: Record<string, ComponentDefinition>
): { id: string; label: string }[] =>
  [rootId, ...descendants(flat, rootId)]
    .filter(id => Object.hasOwn(flat, id))
    .filter(id => {
      const declared = Object.hasOwn(definitions, flat[id].definition.type)
        ? definitions[flat[id].definition.type]
        : undefined;

      return Array.isArray(declared?.definition.items);
    })
    .map(id => ({ id, label: flat[id].definition.label }));
