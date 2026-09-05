import { set, pick, cloneDeep } from '@plitzi/plitzi-ui/helpers';

import { randomElementId } from '@plitzi/sdk-schema/helpers/elementId';

import type { ComponentDefinition, Element, Schema } from '@plitzi/sdk-shared';

/** Mints names for a burst of new elements against one snapshot of the document.
 *
 *  A drop can insert a whole sub-tree at once, and each element of it needs a name that is free of the document AND
 *  of its siblings in the same drop — which is why the taken set is carried across the burst rather than re-read
 *  per element. The random minter, not the positional one: the builder and the MCP write the same document
 *  concurrently, and a counter has both mint `heading-3`. */
export const makeIdMinter = (flat: Schema['flat']) => {
  const taken = new Set(Object.keys(flat));

  return (type: string) => {
    const id = randomElementId(type, candidate => taken.has(candidate));
    taken.add(id);

    return id;
  };
};

export const getInitialItems = (
  parentId: string,
  items: string[] | undefined,
  definitions: Record<string, ComponentDefinition>,
  mintId: (type: string) => string,
  rootId?: string
): { directItems: Record<string, Element>; items: Record<string, Element> } => {
  let result: Record<string, Element> = {};
  const directItems: Record<string, Element> = {};
  if (!items) {
    return { directItems: {}, items: result };
  }

  items.forEach(item => {
    const element = cloneDeep(definitions[item]) as unknown as
      (Pick<ComponentDefinition, 'definition' | 'attributes'> & { id: string; initialItems?: string[] }) | undefined;
    if (!element) {
      return;
    }

    const {
      definition: { items },
      initialItems
    } = element;

    set(element, 'id', mintId(element.definition.type));
    set(element, 'definition.parentId', parentId);
    set(element, 'definition.rootId', rootId);
    let subItems = { directItems: {}, items: {} };
    if (initialItems && !!items) {
      subItems = getInitialItems(element.id, initialItems, definitions, mintId, rootId);
      set(element, 'definition.items', Object.keys(subItems.directItems));
      result = { ...result, ...subItems.items };
    }

    directItems[element.id] = pick(element, ['id', 'attributes', 'definition']);
    result[element.id] = directItems[element.id];
  });

  return { directItems, items: result };
};
