/* eslint-disable @typescript-eslint/no-dynamic-delete */

import get from 'lodash/get';
import set from 'lodash/set';

import { generateID } from '@plitzi/sdk-shared/helpers/utils';
import { VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';
import { calculateInheriting } from '@plitzi/sdk-style/StyleHelper';

import type { Style, Element, Schema, SchemaVariable, DisplayMode, StyleItem, DropPosition } from '@plitzi/sdk-shared';

export const EMPTY_SCHEMA = {
  schema: { flat: {}, variables: [], settings: { customCss: '' }, pages: [], pageFolders: [] } as Schema,
  style: { platform: { desktop: {}, tablet: {}, mobile: {} }, variables: {}, cache: '' } as Style,
  definition: { rootId: '' } // for segments and templates
};

export type FlatMapProps = {
  flat?: Schema['flat'];
  variables?: Schema['variables'];
};

class FlatMap {
  flat: Schema['flat'];
  variables: Schema['variables'];

  constructor(props: FlatMapProps = {}) {
    const { flat, variables } = props;
    if (!flat) {
      throw new Error('Flat is required');
    }

    this.flat = flat;
    this.variables = variables ?? [];
  }

  addElement = (data: Element, to: string, dropPosition = 'inside', initialItems: { [key: string]: Element } = {}) => {
    let parent;
    if (dropPosition !== 'custom') {
      if (dropPosition !== 'inside') {
        const element = this.flat[to] as Element | undefined;
        if (!element) {
          return false;
        }

        if (element.definition.parentId) {
          parent = this.flat[element.definition.parentId];
        }
      } else {
        parent = this.flat[to];
      }

      if (!parent) {
        return false;
      }
    }

    if (
      dropPosition !== 'custom' &&
      ((this.flat[data.id] as Element | undefined) || !Array.isArray(get(parent, 'definition.items')))
    ) {
      return false;
    }

    if (!this.isValidElement(data)) {
      return false;
    }

    set(this.flat, data.id, data);
    switch (dropPosition) {
      case 'left':
      case 'top': {
        const items = get(parent, 'definition.items', []);
        items.splice(
          items.findIndex(i => i === to),
          0,
          data.id
        );

        if (!parent) {
          return false;
        }

        set(this.flat, `${parent.id}.definition.items`, items);
        set(this.flat, `${data.id}.definition.parentId`, parent.id);
        set(this.flat, `${data.id}.definition.rootId`, parent.definition.rootId);

        break;
      }

      case 'right':
      case 'bottom': {
        const items = get(parent, 'definition.items', []);
        items.splice(items.findIndex(i => i === to) + 1, 0, data.id);
        if (!parent) {
          return false;
        }

        set(this.flat, `${parent.id}.definition.items`, items);
        set(this.flat, `${data.id}.definition.parentId`, parent.id);
        set(this.flat, `${data.id}.definition.rootId`, parent.definition.rootId);

        break;
      }

      case 'inside': {
        const items = get(parent, 'definition.items', []);
        if (!parent) {
          return false;
        }

        set(this.flat, `${to}.definition.items`, [...items, data.id]);
        set(this.flat, `${data.id}.definition.parentId`, to);
        set(this.flat, `${data.id}.definition.rootId`, parent.definition.rootId);

        break;
      }

      case 'custom': {
        break;
      }

      default:
        return false;
    }

    if (Object.keys(initialItems).length > 0) {
      Object.keys(initialItems).forEach(itemKey => {
        this.flat[itemKey] = initialItems[itemKey];
      });
    }

    return true;
  };

  updateElement = (element?: Element) => {
    if (!element || !(this.flat[element.id] as Element | undefined)) {
      return false;
    }

    this.flat[element.id] = element;

    return true;
  };

  moveElement = (from: string, to: string, elementId: string, dropPosition: DropPosition = 'inside') => {
    if (elementId === to || !(this.flat[from] as Element | undefined)) {
      return false;
    }

    // Verify if the receptor is child from the sender
    const elementTo = this.flat[to] as Element | undefined;
    if (!elementTo) {
      return false;
    }

    let element = this.flat[to] as Element | undefined;
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

    if (!element) {
      return false;
    }

    // Do the swap
    const fromItems = (get(this.flat, `${from}.definition.items`, []) as string[]).filter(item => item !== elementId);
    if (['left', 'top', 'right', 'bottom'].includes(dropPosition)) {
      if (!elementTo.definition.parentId) {
        return false;
      }

      const parent = this.flat[elementTo.definition.parentId] as Element | undefined;
      if (!parent) {
        return false;
      }

      let parentItems = get(parent, 'definition.items', [] as string[]);
      if (parent.id === from) {
        parentItems = fromItems;
      }

      let dropPositionIndex = parentItems.findIndex(i => i === to);
      if (['right', 'bottom'].includes(dropPosition)) {
        dropPositionIndex++;
      }

      parentItems.splice(dropPositionIndex, 0, elementId);
      set(this.flat, `${from}.definition.items`, fromItems);
      set(this.flat, `${parent.id}.definition.items`, parentItems);
      set(this.flat, `${elementId}.definition.parentId`, parent.id);
    } else if (dropPosition === 'inside') {
      const parent = this.flat[to] as Element | undefined;
      if (!parent) {
        return false;
      }

      let toItems = get(this.flat, `${to}.definition.items`, []) as string[];
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

  getElement = (elementId: string) => get(this.flat, elementId);

  cloneElements = (elementId: string, parentId = '', rootId = '', excludeRoot = false) => {
    const result: { acum: { [key: string]: Element }; item?: Element } = { acum: {}, item: undefined };
    const mapIds: { [key: string]: string } = {};

    const element = this.flat[elementId] as Element | undefined;
    if (!element) {
      return result;
    }

    const elements = [elementId, ...this.childTree(elementId)].reduce<{ [key: string]: Element }>((acum, id) => {
      const element = this.flat[id] as Element | undefined;
      if (!element) {
        return acum;
      }

      mapIds[element.id] = generateID(element.id);
      if (!rootId) {
        return { ...acum, [element.id]: element };
      }

      return { ...acum, [element.id]: { ...element, definition: { ...element.definition, rootId } } };
    }, {});

    try {
      let dataStr = JSON.stringify(elements);
      dataStr = Object.keys(mapIds).reduce((acum, id) => acum.replace(new RegExp(id, 'g'), mapIds[id]), dataStr);
      result.acum = JSON.parse(dataStr) as { [key: string]: Element };
      result.item = result.acum[mapIds[elementId]];
    } catch (e) {
      console.error('Error parsing elements', e);

      return { acum: {}, item: undefined };
    }

    if (excludeRoot) {
      delete result.acum[mapIds[elementId]];
    }

    const parentElement = this.flat[parentId] as Element | undefined;
    if (!parentElement || !Array.isArray(get(parentElement, 'definition.items'))) {
      parentId = get(parentElement, 'definition.parentId', get(element, 'definition.parentId')) as string;
    }

    if (parentId) {
      set(result, 'item.definition.parentId', parentId);
    }

    return result;
  };

  removeElement = (elementId: string, removePage = false) => {
    const element = this.flat[elementId] as Element | undefined;
    if (!element || (element.definition.type === 'page' && !removePage)) {
      return false;
    }

    const elementItems = get(element, 'definition.items');
    if (elementItems && elementItems.length > 0) {
      elementItems.forEach(id => this.removeElement(id));
    }

    const parentId = get(element, 'definition.parentId');
    if (!parentId) {
      return false;
    }

    const parent = this.flat[parentId] as Element | undefined;
    if (parent) {
      const {
        definition: { items = [] }
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

  parentTree = (elementId: string) => {
    let element = this.flat[elementId] as Element | undefined;
    const ids: string[] = [];
    if (!element) {
      return ids;
    }

    do {
      const type = get(element, 'definition.type');
      if (type === 'page') {
        const layout = get(element, 'attributes.layout');
        const layoutContainer = get(element, 'attributes.layoutContainer') as string;
        if (layout && layoutContainer) {
          ids.push(layoutContainer, ...this.parentTree(layoutContainer));
        }
      }

      if (elementId !== element.id) {
        ids.push(element.id);
      }

      element = get(this.flat, get(element, 'definition.parentId') as string) as Element | undefined;
    } while (element);

    return ids;
  };

  childTree = (elementId: string) => {
    const element = this.flat[elementId] as Element | undefined;
    if (!element) {
      return [];
    }

    const ids: string[] = [];
    const children = get(element, 'definition.items');
    if (!children) {
      return ids;
    }

    children.forEach(childId => ids.push(childId, ...this.childTree(childId)));

    return ids;
  };

  isValidElement = (element?: Partial<Element>) => {
    if (!element) {
      return false;
    }

    const { id, attributes, definition } = element;
    if (!id || !definition || !attributes) {
      return false;
    }

    const { type, label, styleSelectors, rootId } = definition as Partial<Element['definition']>;
    if (!type || label === undefined || typeof styleSelectors !== 'object' || rootId === undefined) {
      return false;
    }

    return true;
  };

  flatAsTemplate = (style: Style, elementId: string, excludeRoot = false) => {
    const elementsStyle: Style = { platform: { desktop: {}, tablet: {}, mobile: {} }, variables: {}, cache: '' };
    let variables = [] as SchemaVariable[];
    if (!elementId) {
      return { elements: {}, elementsStyle, variables };
    }

    const element = get(this.flat, elementId) as Element | undefined;
    if (!element) {
      return { elements: { acum: {}, item: undefined }, elementsStyle, variables };
    }

    const elements = this.cloneElements(elementId, element.definition.parentId);
    if (!elements.item) {
      return { elements: {}, elementsStyle, variables };
    }

    Object.values(elements.acum).forEach(element => {
      const { id } = element;
      set(elements.acum, `${id}.definition.rootId`, elements.item?.id);
      const calculatedStyle = calculateInheriting(element, this.flat, style.platform);
      calculatedStyle.tree.forEach(item => {
        const { displayMode, name } = item;
        if (!(name in elementsStyle.platform[displayMode]) && name in style.platform[displayMode]) {
          elementsStyle.platform[displayMode][name] = style.platform[displayMode][name];
        }
      });

      // Variables
      if (this.variables && this.variables.length > 0) {
        const elementVariables = this.getElementVariables(style, id, elements.acum);
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

  getElementVariables = (style: Style, elementId: string, flat = this.flat, variables = this.variables) => {
    const variablesFound: SchemaVariable[] = [];
    if (!variables) {
      return variablesFound;
    }

    const selectors = get(flat, `${elementId}.definition.styleSelectors`) as unknown as
      | Element['definition']['styleSelectors']
      | undefined;
    if (!selectors) {
      return variablesFound;
    }

    Object.values(selectors)
      .filter(Boolean)
      .forEach(selector => {
        Object.values(style.platform).forEach(platform => {
          const elementStyle = platform[selector as DisplayMode] as StyleItem | undefined;
          if (!elementStyle) {
            return;
          }

          Object.values(elementStyle.attributes)
            .filter(attribute => typeof attribute === 'string' && attribute.includes('var('))
            .forEach(attribute => {
              [...(attribute as string).matchAll(VARIABLE_REGEX)].forEach(match => {
                const variableFound = variables.find(variable => variable.name === match.groups?.token);
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

  static getInstance = (props: FlatMapProps) => new this(props);

  static addElement = (flat: Schema['flat'], data: Element, to: string, dropPosition = 'inside', initialItems = {}) =>
    this.getInstance({ flat }).addElement(data, to, dropPosition, initialItems);

  static updateElement = (flat: Schema['flat'], element: Element) => this.getInstance({ flat }).updateElement(element);

  static moveElement = (
    flat: Schema['flat'],
    from: string,
    to: string,
    elementId: string,
    dropPosition: DropPosition = 'inside'
  ) => this.getInstance({ flat }).moveElement(from, to, elementId, dropPosition);

  static getElement = (flat: Schema['flat'], elementId: string) => this.getInstance({ flat }).getElement(elementId);

  static cloneElements = (flat: Schema['flat'], elementId: string, parentId = '', rootId = '', excludeRoot = false) =>
    this.getInstance({ flat }).cloneElements(elementId, parentId, rootId, excludeRoot);

  static removeElement = (flat: Schema['flat'], elementId: string, removePage = false) =>
    this.getInstance({ flat }).removeElement(elementId, removePage);

  // Extra Methods - Static

  static parentTree = (flat: Schema['flat'], elementId: string) => this.getInstance({ flat }).parentTree(elementId);

  static childTree = (flat: Schema['flat'], elementId: string) => this.getInstance({ flat }).childTree(elementId);

  static isValidElement = (flat: Schema['flat'], element: Element) =>
    this.getInstance({ flat }).isValidElement(element);

  static flatAsTemplate = (schema: Schema, style: Style, elementId: string, excludeRoot = false) => {
    const { flat, variables } = schema;

    return this.getInstance({ flat, variables }).flatAsTemplate(style, elementId, excludeRoot);
  };

  static getElementVariables = (schema: Schema, style: Style, elementId: string) => {
    const { flat, variables } = schema;

    return this.getInstance({ flat, variables }).getElementVariables(style, elementId);
  };
}

export default FlatMap;
