/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import calculateInheriting from '@plitzi/sdk-style/helpers/calculateInheriting';

import { elementIdConflict, elementIdsFree, randomElementId, repointIds, takenIds, uniqueElementId } from './elementId';
import { descendants, parentChain } from './elementTree';

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
    const taken = takenIds(this.flat);

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
    // The name has to be well formed and free — of the document AND of the rest of this insert. Refused rather
    // than uniquified: a caller that named an element meant that name, and silently storing it under another one
    // is how a binding written against it resolves to nothing.
    if (!this.isValidElement(data) || !elementIdsFree(this.flat, [data, ...Object.values(initialItems)])) {
      return false;
    }

    if (dropPosition !== 'custom') {
      const placement = this.placement(to, dropPosition, [data.id]);
      if (!placement) {
        return false;
      }

      placement.parent.definition.items = placement.items;
      data.definition.parentId = placement.parent.id;
      data.definition.rootId = placement.parent.definition.rootId;
    }

    this.flat[data.id] = data;
    Object.assign(this.flat, initialItems);

    return true;
  };

  /**
   * Where `ids` go when dropped at `dropPosition` of `to`: the parent that takes them and its items with them in place.
   * Null when there is nowhere to put them — no such element, a sibling of an element with no parent, a parent that
   * holds no items, or an anchor its parent does not list. Computed without writing, so a refusal leaves no trace.
   */
  private placement = (
    to: Element['id'],
    dropPosition: DropPosition,
    ids: Element['id'][],
    without?: Element['id']
  ): { parent: Element; items: Element['id'][] } | null => {
    const anchor = this.flat[to] as Element | undefined;
    const parentId = dropPosition === 'inside' ? to : anchor?.definition.parentId;
    const parent = parentId ? (this.flat[parentId] as Element | undefined) : undefined;
    if (!anchor || !parent?.definition.items) {
      return null;
    }

    const items = parent.definition.items.filter(id => id !== without);
    const at = dropPosition === 'inside' ? items.length : items.indexOf(to);
    if (at < 0 || !['inside', 'left', 'top', 'right', 'bottom'].includes(dropPosition)) {
      return null;
    }

    items.splice(dropPosition === 'right' || dropPosition === 'bottom' ? at + 1 : at, 0, ...ids);

    return { parent, items };
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

  /**
   * Moves an element — and everything in it — next to or inside `to`. Refused when `to` is the element itself or one
   * of its own descendants: the subtree would end up holding itself. Crossing into another page or layout takes the
   * subtree's `rootId` along, so the tree agrees with itself about where everything lives.
   */
  moveElement = (
    from: Element['id'],
    to: Element['id'],
    elementId: Element['id'],
    dropPosition: DropPosition = 'inside'
  ) => {
    const source = this.flat[from] as Element | undefined;
    const element = this.flat[elementId] as Element | undefined;
    if (!source || !element || elementId === to || parentChain(this.flat, to).includes(elementId)) {
      return false;
    }

    const placement = this.placement(to, dropPosition, [elementId], elementId);
    if (!placement) {
      return false;
    }

    source.definition.items = (source.definition.items ?? []).filter(id => id !== elementId);
    placement.parent.definition.items = placement.items;
    element.definition.parentId = placement.parent.id;
    this.carryRoot(elementId, placement.parent.definition.rootId);

    return true;
  };

  /** Points a subtree at the root it now lives under, when a move took it into another page or layout. */
  private carryRoot = (elementId: Element['id'], rootId: Element['id']) => {
    if (this.flat[elementId].definition.rootId === rootId) {
      return;
    }

    for (const id of [elementId, ...descendants(this.flat, elementId)]) {
      this.flat[id].definition.rootId = rootId;
    }
  };

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

    const ids = [elementId, ...descendants(this.flat, elementId)];
    const taken = takenIds(this.flat);
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

    // Dropped onto an element that holds no children, the copy goes beside it instead.
    const parentElement = this.flat[parentId] as Element | undefined;
    if (!parentElement?.definition.items) {
      parentId = parentElement?.definition.parentId ?? element.definition.parentId ?? '';
    }

    if (parentId) {
      result.item.definition.parentId = parentId;
    }

    return result;
  };

  removeElement = (elementId: Element['id'], removePage = false) => {
    const element = this.flat[elementId] as Element | undefined;
    if (
      !element ||
      (element.definition.type === 'page' && !removePage) ||
      (removePage && Boolean(element.attributes.default))
    ) {
      return false;
    }

    for (const id of descendants(this.flat, elementId)) {
      delete this.flat[id];
    }

    const parent = element.definition.parentId
      ? (this.flat[element.definition.parentId] as Element | undefined)
      : undefined;
    if (parent?.definition.items) {
      parent.definition.items = parent.definition.items.filter(id => id !== elementId);
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

    const element = this.flat[elementId] as Element | undefined;
    if (!element) {
      return { elements: { acum: {}, item: undefined }, elementsStyle, variables };
    }

    const elements = this.cloneElements(elementId, element.definition.parentId);
    if (!elements.item) {
      return { elements: { acum: {}, item: undefined }, elementsStyle, variables };
    }

    Object.values(elements.acum).forEach(element => {
      const { id } = element;
      if (elements.item) {
        element.definition.rootId = elements.item.id;
      }

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

    // The base of a template answers to no parent: it is placed wherever the template is dropped.
    delete elements.acum[elements.item.id].definition.parentId;

    if (excludeRoot) {
      delete elements.acum[elements.item.id];
    }

    // Remove duplicated variables
    if (variables.length > 1) {
      variables = [...new Set(variables)];
    }

    return { elements, elementsStyle, variables };
  };

  getElementVariables = (style: Style, elementId: Element['id'], flat = this.flat, variables = this.variables) => {
    const variablesFound: Schema['variables'] = [];
    const selectors = (flat[elementId] as Element | undefined)?.definition.styleSelectors;
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

  static removeVariable = (schemaVariables: Schema['variables'], variable: string) => {
    const instance = this.getInstance({ variables: schemaVariables });

    return instance.removeVariable(variable);
  };

  // Extra Methods - Static

  static flatAsTemplate = (schema: Schema, style: Style, elementId: Element['id'], excludeRoot = false) => {
    const { flat, variables } = schema;

    return this.getInstance({ flat, variables }).flatAsTemplate(style, elementId, excludeRoot);
  };
}

export default FlatMap;
