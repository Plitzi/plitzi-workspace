/* eslint-disable @typescript-eslint/no-dynamic-delete */

import get from 'lodash-es/get.js';
import set from 'lodash-es/set.js';

import { generateID } from '@plitzi/sdk-shared/helpers/utils';
import { VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';
import calculateInheriting from '@plitzi/sdk-style/helpers/calculateInheriting';

import type { Style, Element, Schema, DisplayMode, StyleItem, DropPosition, SchemaVariable } from '@plitzi/sdk-shared';

export const EMPTY_SCHEMA = {
  schema: {
    definition: { name: '', permanentUrl: '' },
    flat: {},
    variables: [],
    settings: { customCss: '' },
    pages: [],
    pageFolders: []
  } as Schema,
  style: {
    platform: { desktop: {}, tablet: {}, mobile: {} },
    variables: {},
    mode: 'desktop-first',
    cache: ''
  } as Style,
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

  addElement = (
    data: Element,
    to: Element['id'],
    dropPosition: DropPosition = 'inside',
    initialItems: Record<Element['id'], Element> = {}
  ) => {
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

  moveElement = (
    from: Element['id'],
    to: Element['id'],
    elementId: Element['id'],
    dropPosition: DropPosition = 'inside'
  ) => {
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
    const fromItems = (get(this.flat, `${from}.definition.items`, []) as Element['id'][]).filter(
      item => item !== elementId
    );
    if (['left', 'top', 'right', 'bottom'].includes(dropPosition)) {
      if (!elementTo.definition.parentId) {
        return false;
      }

      const parent = this.flat[elementTo.definition.parentId] as Element | undefined;
      if (!parent) {
        return false;
      }

      let parentItems = get(parent, 'definition.items', [] as Element['id'][]);
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

      let toItems = get(this.flat, `${to}.definition.items`, []) as Element['id'][];
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

  getElement = (elementId: Element['id']) => get(this.flat, elementId);

  cloneElements = (
    elementId: Element['id'],
    parentId: Element['id'] = '',
    rootId: Element['id'] = '',
    excludeRoot = false
  ) => {
    const result: { acum: Record<Element['id'], Element>; item?: Element } = { acum: {}, item: undefined };
    const mapIds: Record<Element['id'], Element['id']> = {};

    const element = this.flat[elementId] as Element | undefined;
    if (!element) {
      return result;
    }

    const elements = [elementId, ...this.childTree(elementId)].reduce<Record<Element['id'], Element>>((acum, id) => {
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
      result.acum = JSON.parse(dataStr) as Record<Element['id'], Element>;
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
      parentId = get(parentElement, 'definition.parentId', get(element, 'definition.parentId')) as Element['id'];
    }

    if (parentId) {
      set(result, 'item.definition.parentId', parentId);
    }

    return result;
  };

  removeElement = (elementId: Element['id'], removePage = false) => {
    const element = this.flat[elementId] as Element | undefined;
    if (
      !element ||
      (element.definition.type === 'page' && !removePage) ||
      (removePage && get(element, 'attributes.default', false))
    ) {
      return false;
    }

    const elementItems = get(element, 'definition.items');
    if (elementItems && elementItems.length > 0) {
      elementItems.forEach(id => this.removeElement(id));
    }

    const parentId = get(element, 'definition.parentId');
    const parent = parentId ? this.flat[parentId] : undefined;
    if (parentId && parent) {
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

  // Variables

  addVariables = (variables: Schema['variables']) => {
    if ((variables as Schema['variables'] | undefined) && variables.length > 0) {
      const variablesToAppend = variables.filter(variable => !this.variables.find(v => v.name === variable.name));
      this.variables.push(...variablesToAppend);

      return variablesToAppend.length > 0;
    }

    return false;
  };

  addVariable = (variable: SchemaVariable) => {
    if (!(variable as SchemaVariable | undefined)) {
      return false;
    }

    return this.addVariables([variable]);
  };

  updateVariable = (variable: SchemaVariable) => {
    if (!(variable as SchemaVariable | undefined)) {
      return false;
    }

    const pos = this.variables.findIndex(variable => variable.name === variable.name);
    if (pos === -1) {
      return false;
    }

    this.variables[pos] = variable;

    return true;
  };

  removeVariables = (variables: string[]) => {
    variables = variables.filter(Boolean);
    const initialSize = this.variables.length;
    this.variables = this.variables.filter(variable => variables.includes(variable.name));

    return initialSize !== this.variables.length;
  };

  removeVariable = (variable: string) => {
    return this.removeVariables([variable]);
  };

  // Extra Methods

  parentTree = (elementId: Element['id']) => {
    let element = this.flat[elementId] as Element | undefined;
    const ids: Element['id'][] = [];
    if (!element) {
      return ids;
    }

    do {
      const type = get(element, 'definition.type');
      if (type === 'page') {
        const layout = get(element, 'attributes.layout');
        const layoutContainer = get(element, 'attributes.layoutContainer') as Element['id'];
        if (layout && layoutContainer) {
          ids.push(layoutContainer, ...this.parentTree(layoutContainer));
        }
      }

      if (elementId !== element.id) {
        ids.push(element.id);
      }

      element = get(this.flat, get(element, 'definition.parentId') as Element['id']) as Element | undefined;
    } while (element);

    return ids;
  };

  childTree = (elementId: Element['id']) => {
    const element = this.flat[elementId] as Element | undefined;
    if (!element) {
      return [];
    }

    const ids: Element['id'][] = [];
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

  flatAsTemplate = (style: Style, elementId: Element['id'], excludeRoot = false) => {
    const elementsStyle: Style = { platform: { desktop: {}, tablet: {}, mobile: {} }, variables: {}, cache: '' };
    let variables: SchemaVariable[] = [];
    if (!elementId) {
      return { elements: { acum: {}, item: undefined }, elementsStyle, variables };
    }

    const element = get(this.flat, elementId) as Element | undefined;
    if (!element) {
      return { elements: { acum: {}, item: undefined }, elementsStyle, variables };
    }

    const elements = this.cloneElements(elementId, element.definition.parentId);
    if (!elements.item) {
      return { elements: { acum: {}, item: undefined }, elementsStyle, variables };
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
      if (this.variables.length > 0) {
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

  getElementVariables = (style: Style, elementId: Element['id'], flat = this.flat, variables = this.variables) => {
    const variablesFound: Schema['variables'] = [];
    const selectors = get(flat, `${elementId}.definition.styleSelectors`) as unknown as
      | Element['definition']['styleSelectors']
      | undefined;
    if (!selectors) {
      return variablesFound;
    }

    const VARIABLE_REGEX_GLOBAL = new RegExp(VARIABLE_REGEX, 'g');
    Object.values(selectors)
      .filter(Boolean)
      .forEach(selector => {
        Object.values(style.platform).forEach(platform => {
          const elementStyle = platform[selector as DisplayMode] as StyleItem | undefined;
          if (!elementStyle) {
            return;
          }

          Object.values(elementStyle.attributes)
            .filter(attribute => typeof attribute === 'string' && VARIABLE_REGEX.test(attribute))
            .forEach(attribute => {
              [...(attribute as string).matchAll(VARIABLE_REGEX_GLOBAL)].forEach(match => {
                const variableFound = variables.find(
                  variable => variable.name === match[1] || variable.name === match[2]
                );
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

  static addElement = (
    flat: Schema['flat'],
    data: Element,
    to: Element['id'],
    dropPosition: DropPosition = 'inside',
    initialItems: Record<Element['id'], Element> = {}
  ) => this.getInstance({ flat }).addElement(data, to, dropPosition, initialItems);

  static updateElement = (flat: Schema['flat'], element: Element) => this.getInstance({ flat }).updateElement(element);

  static moveElement = (
    flat: Schema['flat'],
    from: Element['id'],
    to: Element['id'],
    elementId: Element['id'],
    dropPosition: DropPosition = 'inside'
  ) => this.getInstance({ flat }).moveElement(from, to, elementId, dropPosition);

  static getElement = (flat: Schema['flat'], elementId: Element['id']) =>
    this.getInstance({ flat }).getElement(elementId);

  static cloneElements = (
    flat: Schema['flat'],
    elementId: Element['id'],
    parentId: Element['id'] = '',
    rootId: Element['id'] = '',
    excludeRoot = false
  ) => this.getInstance({ flat }).cloneElements(elementId, parentId, rootId, excludeRoot);

  static removeElement = (flat: Schema['flat'], elementId: Element['id'], removePage = false) =>
    this.getInstance({ flat }).removeElement(elementId, removePage);

  // Variables - Static

  static addVariables = (schemaVariables: Schema['variables'], variables: Schema['variables']) => {
    const instance = this.getInstance({ variables: schemaVariables });
    instance.addVariables(variables);

    return instance.variables;
  };

  static addVariable = (schemaVariables: Schema['variables'], variable: SchemaVariable) => {
    const instance = this.getInstance({ variables: schemaVariables });
    instance.addVariable(variable);

    return instance.variables;
  };

  static updateVariable = (schemaVariables: Schema['variables'], variable: SchemaVariable) => {
    const instance = this.getInstance({ variables: schemaVariables });
    instance.updateVariable(variable);

    return instance.variables;
  };

  static removeVariables = (schemaVariables: Schema['variables'], variables: string[]) => {
    const instance = this.getInstance({ variables: schemaVariables });
    instance.removeVariables(variables);

    return instance.variables;
  };

  static removeVariable = (schemaVariables: Schema['variables'], variable: string) => {
    const instance = this.getInstance({ variables: schemaVariables });
    instance.removeVariable(variable);

    return instance.variables;
  };

  // Extra Methods - Static

  static parentTree = (flat: Schema['flat'], elementId: Element['id']) =>
    this.getInstance({ flat }).parentTree(elementId);

  static childTree = (flat: Schema['flat'], elementId: Element['id']) =>
    this.getInstance({ flat }).childTree(elementId);

  static isValidElement = (flat: Schema['flat'], element: Element) =>
    this.getInstance({ flat }).isValidElement(element);

  static flatAsTemplate = (schema: Schema, style: Style, elementId: Element['id'], excludeRoot = false) => {
    const { flat, variables } = schema;

    return this.getInstance({ flat, variables }).flatAsTemplate(style, elementId, excludeRoot);
  };

  static getElementVariables = (schema: Schema, style: Style, elementId: Element['id']) => {
    const { flat, variables } = schema;

    return this.getInstance({ flat, variables }).getElementVariables(style, elementId);
  };
}

export default FlatMap;
