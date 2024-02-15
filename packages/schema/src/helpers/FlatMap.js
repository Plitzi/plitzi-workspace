// Packages
import get from 'lodash/get';
import set from 'lodash/set';
import cloneDeep from 'lodash/cloneDeep';

// Monorepo
import { generateID } from '@repo/shared';
import { calculateInheriting } from '@repo/style/StyleHelper';

export const DROP_DIRECTION_TOP = 'top';
export const DROP_DIRECTION_BOTTOM = 'bottom';
export const DROP_DIRECTION_LEFT = 'left';
export const DROP_DIRECTION_RIGHT = 'right';
export const DROP_DIRECTION_INSIDE = 'inside';
export const DROP_DIRECTION_CUSTOM = 'custom';

const addElement = (flat, to, data, dropPosition = DROP_DIRECTION_INSIDE, initialItems = {}) => {
  let parent;
  if (dropPosition !== DROP_DIRECTION_CUSTOM) {
    if (dropPosition !== DROP_DIRECTION_INSIDE) {
      const element = flat[to];
      parent = flat[element.definition.parentId];
    } else {
      parent = flat[to];
    }

    if (!parent) {
      return flat;
    }
  }

  if (
    dropPosition !== DROP_DIRECTION_CUSTOM &&
    (!flat || flat[data.id] || !Array.isArray(get(parent, 'definition.items')))
  ) {
    return flat;
  }

  if (!isValidElement(data)) {
    return flat;
  }

  set(flat, data.id, data);
  switch (dropPosition) {
    case DROP_DIRECTION_LEFT:
    case DROP_DIRECTION_TOP: {
      const items = get(parent, 'definition.items', []);
      items.splice(
        items.findIndex(i => i === to),
        0,
        data.id
      );

      set(flat, `${parent.id}.definition.items`, items);
      set(flat, `${data.id}.definition.parentId`, parent.id);
      set(flat, `${data.id}.definition.rootId`, parent.definition.rootId);

      break;
    }

    case DROP_DIRECTION_RIGHT:
    case DROP_DIRECTION_BOTTOM: {
      const items = get(parent, 'definition.items', []);
      items.splice(items.findIndex(i => i === to) + 1, 0, data.id);
      set(flat, `${parent.id}.definition.items`, items);
      set(flat, `${data.id}.definition.parentId`, parent.id);
      set(flat, `${data.id}.definition.rootId`, parent.definition.rootId);

      break;
    }

    case DROP_DIRECTION_INSIDE: {
      const items = get(parent, 'definition.items', []);
      set(flat, `${to}.definition.items`, [...items, data.id]);
      set(flat, `${data.id}.definition.parentId`, to);
      set(flat, `${data.id}.definition.rootId`, parent.definition.rootId);

      break;
    }

    case DROP_DIRECTION_CUSTOM: {
      break;
    }

    default:
      return flat;
  }

  if (initialItems && Object.keys(initialItems).length > 0) {
    Object.keys(initialItems).forEach(itemKey => {
      flat[itemKey] = initialItems[itemKey];
    });
  }

  return flat;
};

const removeElement = (flat, elementId, removePage = false) => {
  const element = flat[elementId];
  if (!element || (element.definition.type === 'page' && !removePage)) {
    return flat;
  }

  const elementItems = get(element, 'definition.items', []);
  const parentId = get(element, 'definition.parentId');
  if (elementItems && elementItems.length > 0) {
    elementItems.forEach(id => {
      flat = removeElement(flat, id);
    });
  }

  const parent = flat[parentId];
  if (parent) {
    const {
      definition: { items }
    } = parent;

    set(
      parent,
      'definition.items',
      items.filter(id => id !== elementId)
    );

    flat[parentId] = parent;
  }

  delete flat[elementId];

  return flat;
};

const moveElement = (flat, from, to, elementId, dropPosition = DROP_DIRECTION_INSIDE) => {
  if (elementId === to || !flat[from] || !flat[to]) {
    return flat;
  }

  // Verify if the receptor is child from the sender
  let element = flat[to];
  while (element) {
    const parentId = get(element, 'definition.parentId');
    if (!parentId) {
      break;
    }

    if (element.id === elementId) {
      return flat;
    }

    element = flat[parentId];
  }

  // Do the swap
  const fromItems = get(flat, `${from}.definition.items`, []).filter(item => item !== elementId);
  if ([DROP_DIRECTION_LEFT, DROP_DIRECTION_TOP, DROP_DIRECTION_RIGHT, DROP_DIRECTION_BOTTOM].includes(dropPosition)) {
    const element = flat[to];
    const parent = flat[element.definition.parentId];
    if (!parent) {
      return flat;
    }

    let parentItems = get(parent, 'definition.items', []);
    if (parent.id === from) {
      parentItems = fromItems;
    }

    let dropPositionIndex = parentItems.findIndex(i => i === to);
    if ([DROP_DIRECTION_RIGHT, DROP_DIRECTION_BOTTOM].includes(dropPosition)) {
      dropPositionIndex++;
    }

    parentItems.splice(dropPositionIndex, 0, elementId);

    set(flat, `${from}.definition.items`, fromItems);
    set(flat, `${parent.id}.definition.items`, parentItems);
    set(flat, `${elementId}.definition.parentId`, parent.id);
  } else if (dropPosition === DROP_DIRECTION_INSIDE) {
    const parent = flat[to];
    if (!parent) {
      return flat;
    }

    let toItems = get(flat, `${to}.definition.items`, []);
    if (from === to) {
      toItems = fromItems;
    }

    toItems = [...toItems, elementId];

    set(flat, `${from}.definition.items`, fromItems);
    set(flat, `${to}.definition.items`, toItems);
    set(flat, `${elementId}.definition.parentId`, to);
  }

  return flat;
};

const nestedElements = (elementId, flat, parentId, acum = {}) => {
  const element = flat[elementId];
  if (!element) {
    return { item: undefined, acum };
  }

  const {
    definition: { items }
  } = element;

  const newId = generateID();
  if (!items || items.length === 0) {
    acum[newId] = { ...element, definition: { ...element.definition, parentId }, id: newId };

    return { item: acum[newId], acum };
  }

  let newItems = [];
  items.forEach(item => {
    const nestedItems = nestedElements(item, flat, newId);
    if (!nestedItems.item) {
      return;
    }

    acum = { ...acum, ...nestedItems.acum };
    newItems = [...newItems, nestedItems.item.id];
  });

  acum[newId] = { ...element, definition: { ...element.definition, items: newItems, parentId }, id: newId };

  return { item: acum[newId], acum };
};

const cloneNested = (baseElementId, elements) => nestedElements(baseElementId, cloneDeep(elements));

const cloneElement = (flat, elementId, targetId) => {
  if (!flat[elementId]) {
    return flat;
  }

  const {
    definition: { parentId }
  } = flat[elementId];
  if (!parentId) {
    return flat;
  }

  if (!targetId) {
    targetId = parentId;
  }

  const targetParent = flat[targetId];
  const {
    definition: { items: targetItems }
  } = targetParent;
  let newItems = {};
  if (targetItems) {
    newItems = nestedElements(elementId, flat, targetId);
  } else {
    newItems = nestedElements(elementId, flat, parentId);
  }

  return newItems;
};

const parentTree = (flat, elementId) => {
  let element = flat[elementId];
  const ids = [];
  if (!element) {
    return ids;
  }

  do {
    if (elementId !== element.id) {
      ids.push(element.id);
    }

    element = get(flat, get(element, 'definition.parentId'));
  } while (element);

  return ids;
};

const childTree = (flat, elementId) => {
  const element = flat[elementId];
  if (!element) {
    return [];
  }

  const ids = [];
  const children = get(element, 'definition.items');
  if (!children) {
    return ids;
  }

  children.forEach(childId => {
    ids.push(childId);
    ids.push(...childTree(flat, childId));
  });

  return ids;
};

const isValidElement = element => {
  if (!element) {
    return false;
  }

  const { id, attributes, definition } = element;
  if (!id || !definition || !attributes) {
    return false;
  }

  const { type, label, styleSelectors, rootId } = definition;
  if (
    !type ||
    label === undefined ||
    label === null ||
    typeof styleSelectors !== 'object' ||
    styleSelectors === undefined ||
    styleSelectors === null ||
    rootId === undefined ||
    rootId === null
  ) {
    return false;
  }

  return true;
};

const flatAsTemplate = (flat, style, elementId, excludeRoot = false) => {
  const elementsStyle = { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' };

  const element = get(flat, elementId);
  if (!element) {
    return { elements: { acum: {}, item: undefined }, elementsStyle };
  }

  const elements = nestedElements(elementId, flat, element.definition.parentId);

  Object.values(elements.acum).forEach(e => {
    const { id } = e;
    set(elements.acum, `${id}.definition.rootId`, elements.item.id);
    const calculatedStyle = calculateInheriting(e, flat, style.platform);
    calculatedStyle.tree.forEach(item => {
      const { displayMode, name } = item;
      const nameEncoded = btoa(name);
      if (!elementsStyle.platform[displayMode][nameEncoded] && style.platform[displayMode][nameEncoded]) {
        elementsStyle.platform[displayMode][nameEncoded] = style.platform[displayMode][nameEncoded];
      }
    });
  });

  set(elements.acum, `${elements.item.id}.definition.parentId`, null);

  if (excludeRoot) {
    delete elements.acum[elements.item.id];
  }

  return { elements, elementsStyle };
};

const FlatMap = {
  add: addElement,
  remove: removeElement,
  move: moveElement,
  clone: cloneElement,
  cloneNested,
  isValid: isValidElement,
  getNested: nestedElements,
  getParentTree: parentTree,
  getChildTree: childTree,
  flatAsTemplate
};

export default FlatMap;
