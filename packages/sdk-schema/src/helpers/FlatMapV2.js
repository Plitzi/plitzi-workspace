// Packages
import get from 'lodash/get';
import set from 'lodash/set';

// Monorepo
import { generateID } from '@plitzi/sdk-shared/utils';
import { calculateInheriting } from '@plitzi/sdk-style/StyleHelper';

export const DROP_DIRECTION_TOP = 'top';
export const DROP_DIRECTION_BOTTOM = 'bottom';
export const DROP_DIRECTION_LEFT = 'left';
export const DROP_DIRECTION_RIGHT = 'right';
export const DROP_DIRECTION_INSIDE = 'inside';
export const DROP_DIRECTION_CUSTOM = 'custom';

export const VARIABLE_REGEX = /var\(--(?<token>[a-z0-9_-]+)\)/gi;

export const EMPTY_SCHEMA = {
  schema: { flat: {}, variables: [], settings: { customCss: '' }, pages: [], pageFolders: [] },
  style: { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
  definition: { rootId: '' } // for segments and templates
};

class FlatMap {
  constructor(props = {}) {
    const { flat, variables } = props;
    if (!flat) {
      throw new Error('Flat is required');
    }

    this.flat = flat;
    this.variables = variables ?? [];
  }

  addElement = (data, to, dropPosition = DROP_DIRECTION_INSIDE, initialItems = {}) => {
    let parent;
    if (dropPosition !== DROP_DIRECTION_CUSTOM) {
      if (dropPosition !== DROP_DIRECTION_INSIDE) {
        const element = this.flat[to];
        if (!element) {
          return false;
        }

        parent = this.flat[element.definition.parentId];
      } else {
        parent = this.flat[to];
      }

      if (!parent) {
        return false;
      }
    }

    if (
      dropPosition !== DROP_DIRECTION_CUSTOM &&
      (!this.flat || this.flat[data.id] || !Array.isArray(get(parent, 'definition.items')))
    ) {
      return false;
    }

    if (!this.isValidElement(data)) {
      return false;
    }

    set(this.flat, data.id, data);
    switch (dropPosition) {
      case DROP_DIRECTION_LEFT:
      case DROP_DIRECTION_TOP: {
        const items = get(parent, 'definition.items', []);
        items.splice(
          items.findIndex(i => i === to),
          0,
          data.id
        );

        set(this.flat, `${parent.id}.definition.items`, items);
        set(this.flat, `${data.id}.definition.parentId`, parent.id);
        set(this.flat, `${data.id}.definition.rootId`, parent.definition.rootId);

        break;
      }

      case DROP_DIRECTION_RIGHT:
      case DROP_DIRECTION_BOTTOM: {
        const items = get(parent, 'definition.items', []);
        items.splice(items.findIndex(i => i === to) + 1, 0, data.id);
        set(this.flat, `${parent.id}.definition.items`, items);
        set(this.flat, `${data.id}.definition.parentId`, parent.id);
        set(this.flat, `${data.id}.definition.rootId`, parent.definition.rootId);

        break;
      }

      case DROP_DIRECTION_INSIDE: {
        const items = get(parent, 'definition.items', []);
        set(this.flat, `${to}.definition.items`, [...items, data.id]);
        set(this.flat, `${data.id}.definition.parentId`, to);
        set(this.flat, `${data.id}.definition.rootId`, parent.definition.rootId);

        break;
      }

      case DROP_DIRECTION_CUSTOM: {
        break;
      }

      default:
        return false;
    }

    if (initialItems && initialItems.length > 0) {
      initialItems.forEach(childElement => {
        this.flat[childElement.id] = childElement;
      });
    }

    return true;
  };

  updateElement = element => {
    if (!element || !this.flat[element.id]) {
      return false;
    }

    this.flat[element.id] = element;

    return true;
  };

  moveElement = (from, to, elementId, dropPosition = DROP_DIRECTION_INSIDE) => {
    if (elementId === to || !this.flat[from] || !this.flat[to]) {
      return false;
    }

    // Verify if the receptor is child from the sender
    let element = this.flat[to];
    while (element) {
      const parentId = get(element, 'definition.parentId');
      if (!parentId) {
        break;
      }

      if (element.id === elementId) {
        return false;
      }

      element = this.flat[parentId];
    }

    // Do the swap
    const fromItems = get(this.flat, `${from}.definition.items`, []).filter(item => item !== elementId);
    if ([DROP_DIRECTION_LEFT, DROP_DIRECTION_TOP, DROP_DIRECTION_RIGHT, DROP_DIRECTION_BOTTOM].includes(dropPosition)) {
      const element = this.flat[to];
      const parent = this.flat[element.definition.parentId];
      if (!parent) {
        return false;
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

      set(this.flat, `${from}.definition.items`, fromItems);
      set(this.flat, `${parent.id}.definition.items`, parentItems);
      set(this.flat, `${elementId}.definition.parentId`, parent.id);
    } else if (dropPosition === DROP_DIRECTION_INSIDE) {
      const parent = this.flat[to];
      if (!parent) {
        return false;
      }

      let toItems = get(this.flat, `${to}.definition.items`, []);
      if (from === to) {
        toItems = fromItems;
      }

      toItems = [...toItems, elementId];

      set(this.flat, `${from}.definition.items`, fromItems);
      set(this.flat, `${to}.definition.items`, toItems);
      set(this.flat, `${elementId}.definition.parentId`, to);
    }

    return true;
  };

  getElement = elementId => get(this.flat, elementId);

  cloneElements = (elementId, parentId = '', rootId = '', excludeRoot = false) => {
    const result = { acum: {}, item: undefined };
    const mapIds = {};

    const element = this.flat[elementId];
    if (!element) {
      return result;
    }

    const elements = [elementId, ...this.childTree(elementId)]
      .map(id => this.flat[id])
      .filter(Boolean)
      .reduce((acum, element) => {
        mapIds[element.id] = generateID(element.id);
        if (!rootId) {
          return { ...acum, [element.id]: element };
        }

        return { ...acum, [element.id]: { ...element, definition: { ...element.definition, rootId } } };
      }, {});

    try {
      let elementsStr = JSON.stringify(elements);
      elementsStr = Object.keys(mapIds).reduce(
        (acum, id) => acum.replace(new RegExp(id, 'g'), mapIds[id]),
        elementsStr
      );
      result.acum = JSON.parse(elementsStr);
      result.item = result.acum[mapIds[elementId]];
    } catch (e) {
      console.error('Error parsing elements', e);

      return { acum: {}, item: undefined };
    }

    if (excludeRoot) {
      delete result.acum[mapIds[elementId]];
    }

    const parentElement = this.flat[parentId];
    if (!parentElement || !Array.isArray(get(parentElement, 'definition.items'))) {
      parentId = get(parentElement, 'definition.parentId', get(element, 'definition.parentId'));
    }

    if (parentId && result.item) {
      set(result, 'item.definition.parentId', parentId);
    }

    return result;
  };

  removeElement = (elementId, removePage = false) => {
    const element = this.flat[elementId];
    if (!element || (element.definition.type === 'page' && !removePage)) {
      return false;
    }

    const elementItems = get(element, 'definition.items', []);
    const parentId = get(element, 'definition.parentId');
    if (elementItems && elementItems.length > 0) {
      elementItems.forEach(id => this.removeElement(id));
    }

    const parent = this.flat[parentId];
    if (parent) {
      const {
        definition: { items }
      } = parent;

      set(
        parent,
        'definition.items',
        items.filter(id => id !== elementId)
      );

      this.flat[parentId] = parent;
    }

    delete this.flat[elementId];

    return true;
  };

  // Extra Methods

  parentTree = elementId => {
    let element = this.flat[elementId];
    const ids = [];
    if (!element) {
      return ids;
    }

    do {
      const type = get(element, 'definition.type');
      if (type === 'page') {
        const layout = get(element, 'attributes.layout');
        const layoutContainer = get(element, 'attributes.layoutContainer');
        if (layout && layoutContainer) {
          ids.push(layoutContainer, ...this.parentTree(this.flat, layoutContainer));
        }
      }

      if (elementId !== element.id) {
        ids.push(element.id);
      }

      element = get(this.flat, get(element, 'definition.parentId'));
    } while (element);

    return ids;
  };

  childTree = elementId => {
    const element = this.flat[elementId];
    if (!element) {
      return [];
    }

    const ids = [];
    const children = get(element, 'definition.items');
    if (!children) {
      return ids;
    }

    children.forEach(childId => ids.push(childId, ...this.childTree(childId)));

    return ids;
  };

  isValidElement = element => {
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

  flatAsTemplate = (style, elementId, excludeRoot = false) => {
    const elementsStyle = { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' };
    let variables = [];
    if (!style || !elementId) {
      return { elements, elementsStyle, variables };
    }

    const element = get(this.flat, elementId);
    if (!element) {
      return { elements: { acum: {}, item: undefined }, elementsStyle, variables };
    }

    const elements = this.cloneElements(elementId, element.definition.parentId);
    Object.values(elements.acum).forEach(element => {
      const { id } = element;
      set(elements.acum, `${id}.definition.rootId`, elements.item.id);
      const calculatedStyle = calculateInheriting(element, this.flat, style.platform);
      calculatedStyle.tree.forEach(item => {
        const { displayMode, name } = item;
        if (!elementsStyle.platform[displayMode][name] && style.platform[displayMode][name]) {
          elementsStyle.platform[displayMode][name] = style.platform[displayMode][name];
        }
      });

      // Variables
      if (this.variables.length > 0) {
        const elementVariables = this.getElementVariables(id, style, elements.acum);
        variables = [...variables, ...elementVariables];
      }
    });

    set(elements.acum, `${elements.item.id}.definition.parentId`, null);

    if (excludeRoot) {
      delete elements.acum[elements.item.id];
    }

    // Remove duplicated variables
    if (variables.length > 1) {
      variables = [...new Set(variables)];
    }

    return { elements, elementsStyle, variables };
  };

  // Semi - Static

  getElementVariables = (elementId, style, flat = this.flat, variables = this.variables) => {
    const variablesFound = [];
    const selectors = get(flat, `${elementId}.definition.styleSelectors`);
    if (!selectors) {
      return variablesFound;
    }

    Object.values(selectors)
      .filter(Boolean)
      .forEach(selector => {
        Object.values(style?.platform ?? {})
          .filter(platform => platform && selector && !!platform[selector])
          .forEach(platform => {
            const elementStyle = platform[selector];
            Object.values(elementStyle.attributes)
              .filter(attribute => typeof attribute === 'string' && attribute.includes('var('))
              .forEach(attribute => {
                [...attribute.matchAll(VARIABLE_REGEX)].forEach(match => {
                  const variableFound = variables.find(variable => variable.name === match?.groups?.token);
                  if (variableFound && !variablesFound.find(variable => variable.name === variableFound.name)) {
                    variablesFound.push(variableFound);
                  }
                });
              });
          });
      });

    return variablesFound;
  };

  // ===  Static ===

  static getInstance = props => new self(props);

  static addElement = (flat, data, to, dropPosition = DROP_DIRECTION_INSIDE, initialItems = {}) =>
    self.getInstance({ flat }).addElement(data, to, dropPosition, initialItems);

  static updateElement = (flat, element) => self.getInstance({ flat }).updateElement(element);

  static moveElement = (flat, from, to, elementId, dropPosition = DROP_DIRECTION_INSIDE) =>
    self.getInstance({ flat }).moveElement(from, to, elementId, dropPosition);

  static getElement = (flat, elementId) => self.getElement({ flat }).getElement(elementId);

  static cloneElements = (flat, elementId, parentId = '', rootId = '', excludeRoot = false) =>
    self.getInstance({ flat }).cloneElements(elementId, parentId, rootId, excludeRoot);

  static removeElement = (flat, elementId, removePage = false) =>
    self.getInstance({ flat }).removeElement(elementId, removePage);

  // Extra Methods - Static

  static parentTree = (flat, elementId) => self.getInstance({ flat }).parentTree(elementId);

  static childTree = (flat, elementId) => self.getInstance({ flat }).childTree(elementId);

  static isValidElement = (flat, element) => self.getInstance({ flat }).isValidElement(element);

  static flatAsTemplate = (flat, variables, style, elementId, excludeRoot = false) =>
    self.getInstance({ flat, variables }).flatAsTemplate(style, elementId, excludeRoot);

  static getElementVariables = (flat, variables, style, elementId) =>
    self.getInstance({ flat, variables }).getElementVariables(elementId, style);
}

export default FlatMap;
