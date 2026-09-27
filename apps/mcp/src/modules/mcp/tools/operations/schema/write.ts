import { elementIdConflict, isValidElementId } from '@plitzi/sdk-schema/helpers/elementId';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';

import { fail, findRootByRef, indexAddElement, resolveRef } from '../../../helpers';

import type { ElementInput, InitialStateInput, Position } from './shared';
import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { DropPosition, Element, ElementDefinition } from '@plitzi/sdk-shared';

// Shared mutation utilities for the element-schema handlers: stale-resource URI builders and the low-level tree
// operations (create/place/detach) the upsert/move handlers reuse.

export const ID_REF_HINT =
  'Start with a letter, then letters, numbers, hyphens and underscores (e.g. "hero-cta" or "food_item"). The name ' +
  'IS the element id, which the runtime embeds in source names like `apiContainer_<id>.field` and in interaction ' +
  'targets — a dot would split those paths (an underscore is fine: the FIRST `_` separates the type from the id, ' +
  'and element types carry none, so extra underscores are unambiguous).';

const TAKEN_HINT =
  'A name must be unique across the space — pick a different one, or address the existing element by this name.';

/** Every name in an element input tree (the element plus its nested children) — each becomes an element's id. */
export const collectInputRefs = (input: ElementInput): string[] => [
  input.ref,
  ...(input.children ?? []).flatMap(collectInputRefs)
];

/** Validate a name that is about to become an element's id: the charset, then whether anything already answers to
 *  it. Both rules are sdk-schema's `elementIdConflict` — never restated here, so the MCP cannot drift from what
 *  the builder and the schema validator enforce. Null when the name is usable. */
export const guardNewRef = (space: Space, ref: string, field: string): OpResult | null => {
  const conflict = elementIdConflict(space.schema.flat, ref);
  if (!conflict) {
    return null;
  }

  return isValidElementId(ref) ? fail(field, conflict, TAKEN_HINT) : fail(field, conflict, ID_REF_HINT);
};

// URI builders are the single source of truth in helpers/uris; re-exported here so the element-schema handlers
// keep importing them from `../write` unchanged.
export { folderUri, foldersUri, layoutsUri, pageUri, pagesUri, schemaVarsUri, settingsUri } from '../../../helpers';

/** Where an op's `position` puts an element, in the vocabulary of the tree operations every writer shares. */
export const DROP_POSITION: Record<Position, DropPosition> = { inside: 'inside', before: 'top', after: 'bottom' };

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

/**
 * Creates an element from its input, and its children inside it, through `FlatMap` — the same insertion the builder,
 * the server and `authorSpace` make, so a tree the MCP writes is held to exactly their rules. False when the anchor
 * cannot take it: before/after an element with no parent, or inside one that holds no items.
 */
export const createElement = (
  space: Space,
  page: Element,
  input: ElementInput,
  anchorId: string,
  drop: DropPosition
): boolean => {
  const { subType, ...props } = { subType: input.subType, ...input.props };
  const styleSelectors: Record<string, string> = { base: (input.style?.base ?? []).join(' ') };
  for (const [slot, classes] of Object.entries(input.style?.slots ?? {})) {
    styleSelectors[slot] = classes.join(' ');
  }

  // The name the agent chose IS the element's id: the key it addresses the element by here, the `flat` key, AND
  // the key the runtime wires with (a provider registers its source as `<type>_<id>`), so a binding written
  // against this name resolves to this element at runtime with no translation at all.
  const el: Element = {
    id: input.ref,
    attributes: subType === undefined ? props : { subType, ...props },
    definition: {
      rootId: page.id,
      label: input.label ?? input.ref,
      type: input.type,
      items: [],
      styleSelectors: styleSelectors as { base: string; [selector: string]: string },
      // Omitted rather than defaulted to 'shared': the element schema treats an absent runtime as shared already,
      // and stamping every element with an explicit value would make a diff of a builder-authored page noisy.
      ...(input.runtime === undefined ? {} : { runtime: input.runtime })
    }
  };
  if (!new FlatMap({ flat: space.schema.flat }).addElement(el, anchorId, drop)) {
    return false;
  }

  // Keep the page index in step with the new element in O(1), rather than dropping it and paying a full rebuild on
  // the next lookup — so a batch creating hundreds of elements stays linear.
  indexAddElement(space.schema, el, page.id);
  if (input.initialState) {
    writeInitialState(el, input.initialState, false);
  }

  return (input.children ?? []).every(child => createElement(space, page, child, el.id, 'inside'));
};

/** The key an interaction node must store to reach a target element — which is simply that element's name, since
 *  the name it is addressed by and the key the runtime registers callbacks under are now the same thing. A target
 *  that resolves to no element is left as written: it is a source module (`space`, `state`) or a key only a plugin
 *  knows. */
export const resolveTargetRef = (space: Space, elementId: string): string => {
  const el = space.schema.flat[elementId] as Element | undefined;

  return el ? el.id : elementId;
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
  const page = findRootByRef(space.schema, pageRef);
  if (!page) {
    return {
      error: fail(
        'pageRef',
        `Page or layout "${pageRef}" not found`,
        `Read plitzi://schema/${env}/pages for valid refs — a layout shell is named there too`
      )
    };
  }

  const el = resolveRef(space.schema, page, ref);
  if (!el || el.id === page.id) {
    return {
      error: fail('ref', `Element "${ref}" not found in page "${pageRef}"`, 'Name an element this page holds')
    };
  }

  return { el };
};
