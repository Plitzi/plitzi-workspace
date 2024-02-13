// Packages
import get from 'lodash/get';

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
}

const FlatMap = {
  getParentTree: parentTree,
  getChildTree: childTree
};

export default FlatMap;
