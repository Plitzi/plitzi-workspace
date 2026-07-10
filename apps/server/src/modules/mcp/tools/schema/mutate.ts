import { descendantIds, findPageByRef, generateObjectId, resolveRef } from '../../helpers';
import { empty, fail } from '../opResult';

import type { ElementInput } from './operations';
import type { Space } from '../../helpers';
import type { Env } from '../../types';
import type { Operation } from '../operations';
import type { OpResult } from '../opResult';
import type { Element, SchemaVariable } from '@plitzi/sdk-shared';

// Handlers that mutate the ELEMENT schema (space.schema): elements, pages, schema variables.

const pageUri = (env: Env, ref: string): string => `plitzi://schema/${env}/pages/${ref}`;
const pagesUri = (env: Env): string => `plitzi://schema/${env}/pages`;
const schemaVarsUri = (env: Env): string => `plitzi://schema-variables/${env}`;

const removeFromParent = (space: Space, childId: string): void => {
  for (const el of Object.values(space.schema.flat)) {
    if (el.definition.items?.includes(childId)) {
      el.definition.items = el.definition.items.filter(id => id !== childId);
    }
  }
};

const placeChild = (parent: Element, childId: string, index?: number): void => {
  const items = parent.definition.items ?? (parent.definition.items = []);
  if (index === undefined || index < 0 || index >= items.length) {
    items.push(childId);
  } else {
    items.splice(index, 0, childId);
  }
};

const createElement = (
  space: Space,
  page: Element,
  input: ElementInput,
  parent: Element,
  index: number | undefined
): void => {
  const id = generateObjectId();
  const { subType, ...props } = { subType: input.subType, ...input.props };
  const styleSelectors: Record<string, string> = { base: (input.style?.base ?? []).join(' ') };
  for (const [slot, classes] of Object.entries(input.style?.slots ?? {})) {
    styleSelectors[slot] = classes.join(' ');
  }

  space.schema.flat[id] = {
    id,
    attributes: subType === undefined ? props : { subType, ...props },
    definition: {
      rootId: page.id,
      parentId: parent.id,
      label: input.label ?? input.ref,
      type: input.type,
      items: [],
      styleSelectors: styleSelectors as { base: string; [selector: string]: string },
      aiRef: input.ref
    }
  };
  placeChild(parent, id, index);

  for (const child of input.children ?? []) {
    createElement(space, page, child, space.schema.flat[id], undefined);
  }
};

export const upsertElement = (space: Space, env: Env, op: Extract<Operation, { type: 'upsertElement' }>): OpResult => {
  const page = findPageByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page "${op.pageRef}" not found`, 'Read plitzi://schema/' + env + '/pages for valid refs');
  }

  const existing = resolveRef(space.schema, page, op.element.ref);
  if (existing && existing.id !== page.id) {
    if (op.element.label !== undefined) {
      existing.definition.label = op.element.label;
    }

    if (op.element.props !== undefined || op.element.subType !== undefined) {
      const subType = op.element.subType ?? existing.attributes.subType;
      existing.attributes = subType === undefined ? { ...op.element.props } : { subType, ...op.element.props };
    }

    if (op.element.style !== undefined) {
      const selectors: Record<string, string> = { base: (op.element.style.base ?? []).join(' ') };
      for (const [slot, classes] of Object.entries(op.element.style.slots ?? {})) {
        selectors[slot] = classes.join(' ');
      }

      existing.definition.styleSelectors = selectors as { base: string; [selector: string]: string };
    }

    return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.element.ref] };
  }

  let parent = page;
  let index: number | undefined;
  if (op.parentRef) {
    const anchor = resolveRef(space.schema, page, op.parentRef);
    if (!anchor) {
      return fail('parentRef', `Parent "${op.parentRef}" not found in page "${op.pageRef}"`, 'Use an existing ref');
    }

    if (op.position === 'before' || op.position === 'after') {
      parent = anchor.definition.parentId ? space.schema.flat[anchor.definition.parentId] : page;
      const items = parent.definition.items ?? [];
      const at = items.indexOf(anchor.id);
      index = at < 0 ? undefined : op.position === 'after' ? at + 1 : at;
    } else {
      parent = anchor;
    }
  }

  createElement(space, page, op.element, parent, index);

  return { ...empty(), created: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.element.ref] };
};

export const deleteElement = (space: Space, env: Env, op: Extract<Operation, { type: 'deleteElement' }>): OpResult => {
  const page = findPageByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page "${op.pageRef}" not found`, 'Read the pages resource for valid refs');
  }

  const el = resolveRef(space.schema, page, op.ref);
  if (!el || el.id === page.id) {
    return fail(
      'ref',
      `Element "${op.ref}" not found in page "${op.pageRef}"`,
      'Read the page resource for valid refs'
    );
  }

  for (const id of [...descendantIds(space.schema, el.id), el.id]) {
    Reflect.deleteProperty(space.schema.flat, id);
  }

  removeFromParent(space, el.id);

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.pageRef)] };
};

export const moveElement = (space: Space, env: Env, op: Extract<Operation, { type: 'moveElement' }>): OpResult => {
  const page = findPageByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page "${op.pageRef}" not found`, 'Read the pages resource for valid refs');
  }

  const el = resolveRef(space.schema, page, op.ref);
  const anchor = resolveRef(space.schema, page, op.toParentRef);
  if (!el || el.id === page.id) {
    return fail('ref', `Element "${op.ref}" not found`, 'Read the page resource for valid refs');
  }

  if (!anchor) {
    return fail('toParentRef', `Target "${op.toParentRef}" not found`, 'Read the page resource for valid refs');
  }

  removeFromParent(space, el.id);
  let parent = anchor;
  let index: number | undefined;
  if (op.position === 'before' || op.position === 'after') {
    parent = anchor.definition.parentId ? (space.schema.flat[anchor.definition.parentId] ?? page) : page;
    const items = parent.definition.items ?? [];
    const at = items.indexOf(anchor.id);
    index = at < 0 ? undefined : op.position === 'after' ? at + 1 : at;
  }

  el.definition.parentId = parent.id;
  placeChild(parent, el.id, index);

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};

export const upsertPage = (space: Space, env: Env, op: Extract<Operation, { type: 'upsertPage' }>): OpResult => {
  const existing = findPageByRef(space.schema, op.ref);
  if (existing) {
    existing.attributes = {
      ...existing.attributes,
      ...(op.slug !== undefined ? { slug: op.slug } : {}),
      ...(op.label !== undefined ? { name: op.label } : {}),
      ...(op.default !== undefined ? { default: op.default } : {}),
      ...(op.folder !== undefined ? { folder: op.folder } : {})
    };

    return { ...empty(), updated: 1, staleResources: [pageUri(env, op.ref), pagesUri(env)] };
  }

  const id = generateObjectId();
  space.schema.flat[id] = {
    id,
    attributes: { slug: op.slug ?? '', name: op.label ?? op.ref, default: op.default ?? false, folder: op.folder },
    definition: {
      rootId: id,
      label: op.label ?? op.ref,
      type: 'page',
      items: [],
      styleSelectors: { base: '' },
      aiRef: op.ref
    }
  };
  space.schema.pages.push(id);

  return { ...empty(), created: 1, staleResources: [pageUri(env, op.ref), pagesUri(env)] };
};

export const deletePage = (space: Space, env: Env, op: Extract<Operation, { type: 'deletePage' }>): OpResult => {
  const page = findPageByRef(space.schema, op.ref);
  if (!page) {
    return fail('ref', `Page "${op.ref}" not found`, 'Read the pages resource for valid refs');
  }

  for (const id of [...descendantIds(space.schema, page.id), page.id]) {
    Reflect.deleteProperty(space.schema.flat, id);
  }

  space.schema.pages = space.schema.pages.filter(id => id !== page.id);

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.ref), pagesUri(env)] };
};

export const upsertVariable = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'upsertVariable' }>
): OpResult => {
  // The stored SchemaVariable is a discriminated union keyed by runtime `type`; the agent supplies it dynamically.
  const variable = {
    name: op.name,
    category: op.category ?? 'general',
    type: op.variableType,
    value: op.value,
    subValues: op.subValues ?? []
  } as unknown as SchemaVariable;
  const idx = space.schema.variables.findIndex(v => v.name === op.name);
  if (idx >= 0) {
    space.schema.variables[idx] = variable;

    return { ...empty(), updated: 1, staleResources: [schemaVarsUri(env)] };
  }

  space.schema.variables.push(variable);

  return { ...empty(), created: 1, staleResources: [schemaVarsUri(env)] };
};

export const deleteVariable = (
  space: Space,
  env: Env,
  op: Extract<Operation, { type: 'deleteVariable' }>
): OpResult => {
  space.schema.variables = space.schema.variables.filter(v => v.name !== op.name);

  return { ...empty(), deleted: 1, staleResources: [schemaVarsUri(env)] };
};
