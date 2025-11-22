import cloneDeep from 'lodash-es/cloneDeep';
import pick from 'lodash-es/pick';
import set from 'lodash-es/set';

import { generateID } from '../../helpers/utils';

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

    directItems[element.id] = pick(element, ['id', 'attributes', 'definition']);
    result[element.id] = pick(element, ['id', 'attributes', 'definition']);
  });

  return { directItems, items: result };
};
