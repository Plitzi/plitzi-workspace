/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { jsonCopy } from '@plitzi/sdk-shared/history';

import { isValidElementId, repointIds, uniqueElementId } from './elementId';
import { descendants } from './elementTree';
import FlatMap from './FlatMap';

import type { MintElementId } from './elementId';
import type { Element, Schema, SpaceComponent, SpaceComponentDeclaration } from '@plitzi/sdk-shared';

/** The parts of a schema that hold elements: the pages' tree and every component's. */
export type ElementDocument = Pick<Schema, 'flat' | 'pages' | 'components'>;

/** One tree of a document: the space's own `flat`, or the one of the component named. */
export type ElementTree = { flat: Schema['flat']; componentId?: SpaceComponent['id'] };

/**
 * Attributes an instance already answers to, so a prop may not be called one of them: a prop IS an attribute of the
 * instance, and a prop named `referenceId` would be the instance pointing at another component.
 */
export const RESERVED_PROP_NAMES: ReadonlySet<string> = new Set([
  'referenceType',
  'referenceId',
  'slot',
  'className',
  'style',
  'children',
  'ref',
  'id'
]);

// What `{{ props.<name> }}` can read: a '-' would be subtraction there, and a '.' a path into another value.
const PROP_NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Why `name` cannot be a prop, phrased for a person, or null when it can. */
export const propNameProblem = (name: string): string | null => {
  if (!PROP_NAME_RE.test(name)) {
    return `"${name}" is not a valid prop name: start with a letter, then letters, numbers and underscores — it is read as {{ props.${name} }}`;
  }

  return RESERVED_PROP_NAMES.has(name) ? `"${name}" is an attribute every instance already has` : null;
};

export const treesOf = (schema: Pick<Schema, 'flat' | 'components'>): ElementTree[] => [
  { flat: schema.flat },
  ...Object.values(schema.components).map(component => ({ flat: component.flat, componentId: component.id }))
];

/** The tree `id` lives in. Ids are one namespace across the document, so there is at most one. */
export const treeOf = (schema: Pick<Schema, 'flat' | 'components'>, id: Element['id']): ElementTree | undefined =>
  treesOf(schema).find(tree => Object.hasOwn(tree.flat, id));

/** Every element id the document holds, in any tree. */
export const documentIds = (schema: Pick<Schema, 'flat' | 'components'>): Set<Element['id']> =>
  new Set(treesOf(schema).flatMap(tree => Object.keys(tree.flat)));

/**
 * A `FlatMap` over the tree that holds `id`, held to the ids every other tree holds.
 *
 * What lets an element edit carry nothing but the element: its id already says which tree it is in, so the writers
 * of a space — the builder's reducer and the server's model — resolve the tree here and edit it as they always have.
 */
export const flatMapOf = (schema: ElementDocument, id: Element['id'], mintId?: MintElementId): FlatMap | undefined => {
  const tree = treeOf(schema, id);
  if (!tree) {
    return undefined;
  }

  const others = treesOf(schema).filter(other => other.flat !== tree.flat);

  return new FlatMap({
    flat: tree.flat,
    pages: tree.componentId ? undefined : schema.pages,
    mintId,
    takenElsewhere: candidate => others.some(other => Object.hasOwn(other.flat, candidate))
  });
};

/** The component declared under `componentId`, if any: a key read off a document cannot be trusted to be there. */
export const componentNamed = (
  schema: Pick<Schema, 'components'>,
  componentId: SpaceComponent['id']
): SpaceComponent | undefined =>
  Object.hasOwn(schema.components, componentId) ? schema.components[componentId] : undefined;

/** Whether `element` is an instance — of `componentId`, when one is named. */
export const isInstance = (element: Element, componentId?: SpaceComponent['id']): boolean =>
  element.definition.type === 'reference' &&
  element.attributes.referenceType === 'component' &&
  (componentId === undefined || element.attributes.referenceId === componentId);

/** Every instance of a component, wherever it is placed: on a page, in a layout or inside another component. */
export const instancesOf = (
  schema: Pick<Schema, 'flat' | 'components'>,
  componentId: SpaceComponent['id']
): Element[] =>
  treesOf(schema).flatMap(tree => Object.values(tree.flat).filter(element => isInstance(element, componentId)));

/**
 * Renames an element wherever it is, carrying every reference to it — in any tree.
 *
 * The element's own tree is rewritten by `FlatMap`, as a rename always was; the others are rewritten too, because a
 * page can name an element of a component as little as a component can name a page, and the declarations name their
 * roots and slots. Returns the ids of everything it touched, under their new names.
 */
export const renameElement = (
  schema: ElementDocument,
  from: Element['id'],
  to: Element['id']
): Element['id'][] | false => {
  const map = flatMapOf(schema, from);
  if (!map) {
    return false;
  }

  const touched = map.renameElement(from, to);
  if (!touched || from === to) {
    return touched;
  }

  for (const tree of treesOf(schema)) {
    if (tree.flat !== map.flat) {
      touched.push(...repointIds(tree.flat, { [from]: to }));
    }
  }

  for (const component of Object.values(schema.components)) {
    if (component.rootId === from) {
      component.rootId = to;
    }

    if (component.slots?.includes(from)) {
      component.slots = component.slots.map(slot => (slot === from ? to : slot));
    }
  }

  return [...new Set(touched)];
};

/** Why a declaration cannot stand against the tree it declares, or null when it can. */
const declarationProblem = (declaration: SpaceComponentDeclaration, flat: SpaceComponent['flat']): string | null => {
  for (const name of Object.keys(declaration.props ?? {})) {
    const problem = propNameProblem(name);
    if (problem) {
      return problem;
    }
  }

  const missing = (declaration.slots ?? []).find(slot => !Object.hasOwn(flat, slot));

  return missing ? `slot "${missing}" is not an element of the component` : null;
};

/** The element an instance is, made for `component` at the place `at` held. */
const instanceFor = (component: SpaceComponent, instanceId: Element['id'], at: Element): Element => ({
  id: instanceId,
  attributes: { referenceType: 'component', referenceId: component.id },
  definition: {
    label: component.label ?? component.id,
    type: 'reference',
    items: [],
    bindings: {},
    parentId: at.definition.parentId,
    rootId: at.definition.rootId,
    styleSelectors: { base: '' },
    initialState: { visibility: true }
  }
});

/**
 * Declares a component.
 *
 * With `from`, the component is made OF an element already in the document: the subtree leaves its tree for the
 * component's, and an instance named `from.instanceId` takes its place, so the page renders what it rendered. Without
 * it, the component brings its own tree. Both sides of a live document apply the same call and arrive at the same
 * document, which is why the instance's name is the caller's to give. Returns false, changing nothing, when the
 * component cannot be declared — a name taken, a tree that is not one, a declaration its tree does not bear out.
 */
export const addComponent = (
  schema: ElementDocument,
  component: SpaceComponent,
  from?: { elementId: Element['id']; instanceId: Element['id'] }
): boolean => {
  if (!isValidElementId(component.id) || Object.hasOwn(schema.components, component.id)) {
    return false;
  }

  if (!from) {
    const root = component.flat[component.rootId] as Element | undefined;
    const taken = documentIds(schema);
    if (
      !root ||
      root.definition.parentId ||
      Object.keys(component.flat).some(id => taken.has(id)) ||
      declarationProblem(component, component.flat)
    ) {
      return false;
    }

    schema.components[component.id] = component;

    return true;
  }

  const { elementId, instanceId } = from;
  const tree = treeOf(schema, elementId);
  const element = tree?.flat[elementId];
  const parent = element?.definition.parentId ? tree?.flat[element.definition.parentId] : undefined;
  if (
    !tree ||
    !element ||
    !parent?.definition.items ||
    !isValidElementId(instanceId) ||
    documentIds(schema).has(instanceId)
  ) {
    return false;
  }

  const flat: SpaceComponent['flat'] = {};
  for (const id of [elementId, ...descendants(tree.flat, elementId)]) {
    const { parentId, ...definition } = tree.flat[id].definition;
    flat[id] = {
      ...tree.flat[id],
      definition: { ...definition, ...(id === elementId ? {} : { parentId }), rootId: elementId }
    };
  }

  const declared: SpaceComponent = { ...component, rootId: elementId, flat };
  if (declarationProblem(declared, flat)) {
    return false;
  }

  for (const id of Object.keys(flat)) {
    delete tree.flat[id];
  }

  tree.flat[instanceId] = instanceFor(declared, instanceId, element);
  parent.definition.items = parent.definition.items.map(id => (id === elementId ? instanceId : id));
  schema.components[declared.id] = declared;

  return true;
};

/** Changes what a component declares — never its tree, which is edited element by element like any other. */
export const updateComponent = (
  schema: Pick<Schema, 'components'>,
  componentId: SpaceComponent['id'],
  declaration: SpaceComponentDeclaration
): boolean => {
  const component = componentNamed(schema, componentId);
  if (!component || declarationProblem({ ...component, ...declaration }, component.flat)) {
    return false;
  }

  schema.components[componentId] = { ...component, ...declaration };

  return true;
};

/** Removes a component nothing places any more. One still placed is refused: its instances would render nothing. */
export const removeComponent = (
  schema: Pick<Schema, 'flat' | 'components'>,
  componentId: SpaceComponent['id']
): boolean => {
  if (!Object.hasOwn(schema.components, componentId) || instancesOf(schema, componentId).length > 0) {
    return false;
  }

  delete schema.components[componentId];

  return true;
};

/**
 * Replaces an instance with a copy of what its component renders, which is then the page's own to edit.
 *
 * The copy takes names derived from the component's (`card` → `card-2`), each the first one free in the document,
 * so every side of a live document that applies it arrives at the same names. What filled the instance's slots goes
 * into the copies of those slots. Refused when a child has no slot to go to. Returns the copy's root id.
 */
export const detachInstance = (schema: ElementDocument, instanceId: Element['id']): Element['id'] | false => {
  const tree = treeOf(schema, instanceId);
  const instance = tree?.flat[instanceId];
  const { referenceId } = instance?.attributes ?? {};
  const component =
    instance && isInstance(instance) && typeof referenceId === 'string'
      ? componentNamed(schema, referenceId)
      : undefined;
  const parent = instance?.definition.parentId ? tree?.flat[instance.definition.parentId] : undefined;
  if (!tree || !instance || !component || !parent?.definition.items) {
    return false;
  }

  const children = instance.definition.items ?? [];
  const slotOf = (childId: Element['id']): Element['id'] | undefined => {
    const { slot } = tree.flat[childId].attributes;

    return typeof slot === 'string' ? slot : component.slots?.[0];
  };
  if (children.some(childId => !component.slots?.includes(slotOf(childId) ?? ''))) {
    return false;
  }

  const taken = documentIds(schema);
  taken.delete(instanceId);
  const ids = [component.rootId, ...descendants(component.flat, component.rootId)];
  const names: Record<Element['id'], Element['id']> = {};
  for (const id of ids) {
    names[id] = uniqueElementId(id, candidate => taken.has(candidate));
    taken.add(names[id]);
  }

  const copies: Schema['flat'] = {};
  for (const id of ids) {
    const copy = jsonCopy(component.flat[id]);
    copy.definition.rootId = instance.definition.rootId;
    copies[id] = copy;
  }

  repointIds(copies, names);
  const root = copies[names[component.rootId]];
  root.definition.parentId = instance.definition.parentId;

  for (const childId of children) {
    const slot = copies[names[slotOf(childId) ?? '']];
    const child = tree.flat[childId];
    const { slot: _slot, ...attributes } = child.attributes;
    tree.flat[childId] = { ...child, attributes, definition: { ...child.definition, parentId: slot.id } };
    slot.definition.items = [...(slot.definition.items ?? []), childId];
  }

  Object.assign(tree.flat, copies);
  delete tree.flat[instanceId];
  parent.definition.items = parent.definition.items.map(id => (id === instanceId ? root.id : id));

  return root.id;
};
