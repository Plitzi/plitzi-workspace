/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, set } from '@plitzi/plitzi-ui/helpers';

import { EMPTY_SCHEMA, VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import calculateInheriting from '@plitzi/sdk-style/helpers/calculateInheriting';

import { elementIdConflict, elementIdsFree, randomElementId, repointIds, takenIds, uniqueElementId } from './elementId';
import { validateSchema, type SchemaValidationResult } from './schemaValidator';

import type { MintElementId } from './elementId';
import type { Style, Element, Schema, DisplayMode, StyleItem, DropPosition, SchemaVariable } from '@plitzi/sdk-shared';

/** An element on its way in. Its id is the name it will answer to, and leaving it out asks this map to mint one. */
export type ElementInput = Omit<Element, 'id'> & { id?: Element['id'] };

export type FlatMapProps = {
  flat?: Schema['flat'];
  variables?: Schema['variables'];
  /**
   * The document's page list. Given, a page rename rewrites it too — a page renamed without it is a page the space
   * no longer lists. Left out for a map that holds no pages (a segment, a template being cut).
   */
  pages?: Schema['pages'];
  /**
   * How an id is minted for an element nobody named. Defaults to the random minter, which is what a live document
   * wants: the builder and the MCP write concurrently, and a counter has two writers pick the same name. An
   * offline author or a test passes a positional one and gets output it can diff.
   */
  mintId?: MintElementId;
};

class FlatMap {
  flat: Schema['flat'];
  variables: Schema['variables'];
  pages: Schema['pages'];
  mintId: MintElementId;

  constructor(props: FlatMapProps = {}) {
    const { flat, variables, pages, mintId } = props;
    if (!flat) {
      throw new Error('Flat is required');
    }

    this.flat = flat;
    this.variables = variables ?? [];
    this.pages = pages ?? [];
    this.mintId = mintId ?? randomElementId;
  }

  /** A free id for a new element of `type`, minted through this map's minter and unique against what it holds. */
  nextId = (type: string, alsoTaken: (candidate: string) => boolean = () => false) => {
    const taken = this.takenIds();

    return this.mintId(type, candidate => taken.has(candidate) || alsoTaken(candidate));
  };

  /** Inserts an element, minting its id when the caller did not name it. Nothing else in the codebase mints an
   *  element id: every writer goes through here, so "every element has a name" is true by construction. */
  addElement = (
    input: ElementInput,
    to: Element['id'],
    dropPosition: DropPosition = 'inside',
    initialItems: Record<Element['id'], Element> = {}
  ) => {
    const data: Element = input.id ? (input as Element) : { ...input, id: this.nextId(input.definition.type) };
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

    if (dropPosition !== 'custom' && !Array.isArray(get(parent, 'definition.items'))) {
      return false;
    }

    if (!this.isValidElement(data)) {
      return false;
    }

    // The name has to be well formed and free — of the document AND of the rest of this insert. Refused rather
    // than uniquified: a caller that named an element meant that name, and silently storing it under another one
    // is how a binding written against it resolves to nothing.
    if (!elementIdsFree(this.flat, [data, ...Object.values(initialItems)])) {
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

  /** Replaces a stored element with an edited copy of itself. The id is its identity, not a field an update may
   *  carry a new value for — changing the name is `renameElement`, which is a document-wide operation. */
  updateElement = (element?: Element) => {
    if (!element || !(this.flat[element.id] as Element | undefined)) {
      return false;
    }

    this.flat[element.id] = element;

    return true;
  };

  /**
   * Renames an element, carrying its wiring with it.
   *
   * The id IS the name — the `flat` key, what the tree points at, the `<type>_<id>` a binding reads and the target
   * an interaction fires on — so a rename that only rewrote the key would silently unwire the element and every
   * reference to it. `repointIds` rewrites all of them in one pass; doing it at the single point every writer goes
   * through is what makes a readable id safe to change.
   *
   * Returns the ids of every element the rename touched (under their new names), which a caller broadcasting the
   * change has to publish: the one element it renamed is almost never the whole of what moved.
   */
  renameElement = (from: Element['id'], to: Element['id']): Element['id'][] | false => {
    if (!(this.flat[from] as Element | undefined)) {
      return false;
    }

    if (from === to) {
      return [];
    }

    if (elementIdConflict(this.flat, to)) {
      return false;
    }

    return repointIds(this.flat, { [from]: to }, this.pages);
  };

  /** Why this element cannot be renamed to `id` (charset or a clash), or null when the name is free. */
  renameConflict = (from: Element['id'], id: string) => elementIdConflict(this.flat, id, from);

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

  /** Every id currently in use, so a newly minted one stays unique across the document. */
  takenIds = () => takenIds(this.flat);

  /** Why an id cannot be used here (charset or a clash), or null when it is free. `ignoreElementId` exempts the
   *  element being edited, so re-saving an element its own name is not a conflict. */
  elementIdConflict = (id: string, ignoreElementId?: Element['id']) =>
    elementIdConflict(this.flat, id, ignoreElementId);

  /**
   * Copies a subtree onto fresh names.
   *
   * Every id in the copy is minted here and every reference inside it repointed structurally, field by field. It is
   * emphatically NOT a string replace over the serialized tree, which is what this used to be: that only ever
   * worked because an id was 24 improbable hex characters, and with an id that reads like `hero` it would rewrite
   * the word inside labels, prose, class names and content. References pointing OUT of the subtree are left alone,
   * so a copy keeps reading the data source it was cloned next to.
   */
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

    const ids = [elementId, ...this.childTree(elementId)].filter(
      id => (this.flat[id] as Element | undefined) !== undefined
    );
    const taken = this.takenIds();
    for (const id of ids) {
      // Derived from the name being copied, not minted from the type: a copy of `hero` is `hero-2`, which still
      // says what it is.
      const copyId = uniqueElementId(id, candidate => taken.has(candidate));
      taken.add(copyId);
      mapIds[id] = copyId;
    }

    // `structuredClone` rather than a spread: the source elements are usually deeply frozen store state, and
    // `repointIds` rewrites bindings, params and items in place.
    const acum: Record<Element['id'], Element> = {};
    for (const id of ids) {
      const copy = structuredClone(this.flat[id]);
      if (rootId) {
        copy.definition.rootId = rootId;
      }

      acum[id] = copy;
    }

    repointIds(acum, mapIds);
    result.acum = acum;
    result.item = acum[mapIds[elementId]];

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
      (removePage && get(element, 'attributes.default', false as boolean))
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

      element = get(this.flat, get(element, 'definition.parentId') as Element['id'], undefined);
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
    const elementsStyle: Style = { ...EMPTY_STYLE_SCHEMA, platform: { desktop: {}, tablet: {}, mobile: {} } };
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
      const calculatedStyle = calculateInheriting(
        element,
        element.definition.type,
        this.flat,
        style.platform,
        {},
        { includeSelf: true }
      );
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

  // Validation

  validate = (): SchemaValidationResult => {
    return validateSchema({ ...EMPTY_SCHEMA.schema, flat: this.flat, variables: this.variables });
  };

  isValid = (): boolean => {
    return this.validate().valid;
  };

  assertValid = (context?: string): void => {
    const result = validateSchema({ ...EMPTY_SCHEMA.schema, flat: this.flat, variables: this.variables });
    if (!result.valid) {
      const message = `Invalid schema${context ? ` (${context})` : ''}: ${result.errors.map(e => e.message).join('; ')}`;

      throw new Error(message);
    }
  };

  // Semi - Static

  getElementVariables = (style: Style, elementId: Element['id'], flat = this.flat, variables = this.variables) => {
    const variablesFound: Schema['variables'] = [];
    const selectors = get(flat, `${elementId}.definition.styleSelectors`) as unknown as
      Element['definition']['styleSelectors'] | undefined;
    if (!selectors) {
      return variablesFound;
    }

    const VARIABLE_REGEX_GLOBAL = new RegExp(VARIABLE_REGEX, 'g');
    Object.values(selectors)
      .filter(Boolean)
      .forEach(selector => {
        Object.values(style.platform).forEach(platform => {
          const styleItem = platform[selector as DisplayMode] as StyleItem | undefined;
          if (!styleItem) {
            return;
          }

          [...JSON.stringify(styleItem.attributes).matchAll(VARIABLE_REGEX_GLOBAL)].forEach(match => {
            const variableFound = variables.find(variable => variable.name === match[1] || variable.name === match[2]);
            if (variableFound && !variablesFound.find(variable => variable.name === variableFound.name)) {
              variablesFound.push(variableFound);
            }
          });
        });
      });

    return variablesFound;
  };

  // ===  Static ===

  static getInstance = (props: FlatMapProps) => new this(props);

  static addElement = (
    flat: Schema['flat'],
    data: ElementInput,
    to: Element['id'],
    dropPosition: DropPosition = 'inside',
    initialItems: Record<Element['id'], Element> = {}
  ) => this.getInstance({ flat }).addElement(data, to, dropPosition, initialItems);

  static updateElement = (flat: Schema['flat'], element: Element) => this.getInstance({ flat }).updateElement(element);

  static renameElement = (schema: Pick<Schema, 'flat' | 'pages'>, from: Element['id'], to: Element['id']) =>
    this.getInstance({ flat: schema.flat, pages: schema.pages }).renameElement(from, to);

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

  static takenIds = (flat: Schema['flat']) => this.getInstance({ flat }).takenIds();

  static elementIdConflict = (flat: Schema['flat'], id: string, ignoreElementId?: Element['id']) =>
    this.getInstance({ flat }).elementIdConflict(id, ignoreElementId);

  // Variables - Static

  static addVariables = (schemaVariables: Schema['variables'], variables: Schema['variables']) => {
    const instance = this.getInstance({ variables: schemaVariables });

    return instance.addVariables(variables);
  };

  static addVariable = (schemaVariables: Schema['variables'], variable: SchemaVariable) => {
    const instance = this.getInstance({ variables: schemaVariables });

    return instance.addVariable(variable);
  };

  static updateVariable = (schemaVariables: Schema['variables'], variable: SchemaVariable) => {
    const instance = this.getInstance({ variables: schemaVariables });

    return instance.updateVariable(variable);
  };

  static removeVariables = (schemaVariables: Schema['variables'], variables: string[]) => {
    const instance = this.getInstance({ variables: schemaVariables });

    return instance.removeVariables(variables);
  };

  static removeVariable = (schemaVariables: Schema['variables'], variable: string) => {
    const instance = this.getInstance({ variables: schemaVariables });

    return instance.removeVariable(variable);
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

  // Validation - Static

  static validate = (schema: Schema): SchemaValidationResult => {
    return validateSchema(schema);
  };

  static isValid = (schema: Schema): boolean => {
    return validateSchema(schema).valid;
  };

  static assertValid = (schema: Schema, context?: string): void => {
    const result = validateSchema(schema);
    if (!result.valid) {
      const message = `Invalid schema${context ? ` (${context})` : ''}: ${result.errors.map(e => e.message).join('; ')}`;

      throw new Error(message);
    }
  };
}

export default FlatMap;
