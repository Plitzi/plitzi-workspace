// Packages
import set from 'lodash/set';
import pick from 'lodash/pick';
import cloneDeep from 'lodash/cloneDeep';

// Relatives
import { generateID } from '../../helpers/utils';

export const getInitialItems = (parentId, items, definitions, rootId) => {
  let result = {};
  const directItems = {};
  if (!items) {
    return result;
  }

  items.forEach(item => {
    const element = cloneDeep(definitions[item]);
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
    let subItems = {};
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
