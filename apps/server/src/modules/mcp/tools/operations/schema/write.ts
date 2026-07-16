import { fail, findPageByRef, generateObjectId, resolveRef } from '../../../helpers';

import type { ElementInput, InitialStateInput } from './shared';
import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { Element, ElementDefinition } from '@plitzi/sdk-shared';

// Shared mutation utilities for the element-schema handlers: stale-resource URI builders and the low-level tree
// operations (create/place/detach) the upsert/move handlers reuse.

export const pageUri = (env: Env, ref: string): string => `plitzi://schema/${env}/pages/${ref}`;
export const pagesUri = (env: Env): string => `plitzi://schema/${env}/pages`;
export const foldersUri = (env: Env): string => `plitzi://folders/${env}`;
export const folderUri = (env: Env, ref: string): string => `plitzi://folders/${env}/${ref}`;
export const schemaVarsUri = (env: Env): string => `plitzi://schema-variables/${env}`;

export const removeFromParent = (space: Space, childId: string): void => {
  for (const el of Object.values(space.schema.flat)) {
    if (el.definition.items?.includes(childId)) {
      el.definition.items = el.definition.items.filter(id => id !== childId);
    }
  }
};

export const placeChild = (parent: Element, childId: string, index?: number): void => {
  const items = parent.definition.items ?? (parent.definition.items = []);
  if (index === undefined || index < 0 || index >= items.length) {
    items.push(childId);
  } else {
    items.splice(index, 0, childId);
  }
};

// Write the two initial-state fields agents control (which variant each class uses + initial visibility) onto an
// element, always preserving any other initialState keys (styleSelectors overrides, plugin-specific). `merge`
// overlays styleVariant per class/selector (patch); otherwise it replaces the whole styleVariant map (upsert).
export const writeInitialState = (el: Element, input: InitialStateInput, merge: boolean): void => {
  const current = el.definition.initialState ?? {};
  const next: NonNullable<ElementDefinition['initialState']> = { ...current };

  if (input.styleVariant !== undefined) {
    if (merge) {
      type StyleVariantMap = NonNullable<NonNullable<ElementDefinition['initialState']>['styleVariant']>;
      const merged: StyleVariantMap = { ...current.styleVariant };
      for (const [cls, selectors] of Object.entries(input.styleVariant)) {
        merged[cls] = { ...merged[cls], ...selectors };
      }

      next.styleVariant = merged;
    } else {
      next.styleVariant = input.styleVariant;
    }
  }

  if (input.visibility !== undefined) {
    next.visibility = input.visibility;
  }

  el.definition.initialState = next;
};

export const createElement = (
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

  if (input.initialState) {
    writeInitialState(space.schema.flat[id], input.initialState, false);
  }

  for (const child of input.children ?? []) {
    createElement(space, page, child, space.schema.flat[id], undefined);
  }
};

/** Resolve a non-page element within a page for the element-scoped ops (bindings, interactions). Returns the
 *  element, or a teachable OpResult when the page or element ref does not resolve — so each op reports the same
 *  errors as patchElement without repeating them. */
export const resolveElement = (
  space: Space,
  env: Env,
  pageRef: string,
  ref: string
): { el: Element } | { error: OpResult } => {
  const page = findPageByRef(space.schema, pageRef);
  if (!page) {
    return {
      error: fail('pageRef', `Page "${pageRef}" not found`, `Read plitzi://schema/${env}/pages for valid refs`)
    };
  }

  const el = resolveRef(space.schema, page, ref);
  if (!el || el.id === page.id) {
    return {
      error: fail('ref', `Element "${ref}" not found in page "${pageRef}"`, 'Use an existing element ref or id')
    };
  }

  return { el };
};
