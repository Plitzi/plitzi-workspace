import { set, pick, cloneDeep } from '@plitzi/plitzi-ui/helpers';

import { generateID } from '@plitzi/sdk-shared/helpers/utils';

import type { ComponentDefinition, Element } from '@plitzi/sdk-shared';

export const getInitialItems = (
  parentId: string,
  items: string[] | undefined,
  definitions: Record<string, ComponentDefinition>,
  rootId?: string
): { directItems: Record<string, Element>; items: Record<string, Element> } => {
  let result: Record<string, Element> = {};
  const directItems: Record<string, Element> = {};
  if (!items) {
    return { directItems: {}, items: result };
  }

  items.forEach(item => {
    const element = cloneDeep(definitions[item]) as unknown as
      | (Pick<ComponentDefinition, 'definition' | 'attributes'> & { id: string; initialItems?: string[] })
      | undefined;
    if (!element) {
      return;
    }

    const {
      definition: { items },
      initialItems
    } = element;

    set(element, 'id', generateID());
    set(element, 'definition.parentId', parentId);
    set(element, 'definition.rootId', rootId);
    let subItems = { directItems: {}, items: {} };
    if (initialItems && !!items) {
      subItems = getInitialItems(element.id, initialItems, definitions, rootId);
      set(element, 'definition.items', Object.keys(subItems.directItems));
      result = { ...result, ...subItems.items };
    }

    directItems[element.id] = pick(element, ['id', 'attributes', 'definition']) as Element;
    result[element.id] = directItems[element.id];
  });

  return { directItems, items: result };
};
