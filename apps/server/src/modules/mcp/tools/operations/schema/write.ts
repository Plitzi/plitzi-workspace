import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { isValidIdRef, makeIdRef } from '@plitzi/sdk-schema/helpers/idRef';

import { fail, findElementByRef, findPageByRef, generateObjectId, invalidateIndex, resolveRef } from '../../../helpers';

import type { ElementInput, InitialStateInput } from './shared';
import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { Element, ElementDefinition } from '@plitzi/sdk-shared';

// Shared mutation utilities for the element-schema handlers: stale-resource URI builders and the low-level tree
// operations (create/place/detach) the upsert/move handlers reuse.

export const ID_REF_HINT =
  'Use only letters, numbers and hyphens (e.g. "hero-cta"). The ref becomes the element idRef, which the runtime ' +
  'embeds in source names like `apiContainer_<idRef>.field` and in interaction targets — a dot or underscore would ' +
  'break those paths.';

const TAKEN_HINT =
  'An idRef must be unique across the space — pick a different ref, or address the existing element by this ref.';

/** Every ref in an element input tree (the element plus its nested children) — each becomes a new element's idRef. */
export const collectInputRefs = (input: ElementInput): string[] => [
  input.ref,
  ...(input.children ?? []).flatMap(collectInputRefs)
];

/** Validate a ref that is about to become an element's idRef: the charset, then whether anything already answers
 *  to it. The charset rule is sdk-schema's `isValidIdRef` — never a regex restated here, so the MCP cannot drift
 *  from what the builder and the schema validator enforce.
 *
 *  Uniqueness is checked with the ref lookups rather than `FlatMap.idRefConflict`, and deliberately so: these are
 *  a superset of it. FlatMap asks whether another element holds this idRef; the MCP must also refuse a ref that
 *  shadows a raw id or a page slug, because its handlers resolve refs through those too — calling both would just
 *  run the same rule twice. Null when the ref is usable.
 *
 *  Enforced here, at every point a ref BECOMES an idRef — addressing an existing element by its raw id is not
 *  charset-checked, which is why the validator cannot simply tighten its own REF_RE for every ref it sees. */
export const guardNewRef = (space: Space, ref: string, field: string): OpResult | null => {
  if (!isValidIdRef(ref)) {
    return fail(field, `"${ref}" is not a valid idRef`, ID_REF_HINT);
  }

  if (findElementByRef(space.schema, ref) || findPageByRef(space.schema, ref)) {
    return fail(field, `"${ref}" is already used by another element in this space`, TAKEN_HINT);
  }

  return null;
};

// URI builders are the single source of truth in helpers/uris; re-exported here so the element-schema handlers
// keep importing them from `../write` unchanged.
export { folderUri, foldersUri, pageUri, pagesUri, schemaVarsUri, settingsUri } from '../../../helpers';

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
    // The agent's chosen ref IS the element's idRef: the key it addresses the element by here AND the key the
    // runtime wires with (a provider registers its source as `<type>_<idRef>`), so a binding written against this
    // ref resolves to this element at runtime with no id translation.
    idRef: input.ref,
    attributes: subType === undefined ? props : { subType, ...props },
    definition: {
      rootId: page.id,
      parentId: parent.id,
      label: input.label ?? input.ref,
      type: input.type,
      items: [],
      styleSelectors: styleSelectors as { base: string; [selector: string]: string }
    }
  };
  placeChild(parent, id, index);
  // A new element changes what the ref index resolves (elementByRef, pageOf), so drop it here — the single point
  // element creation happens. Cheap (a map delete); the next ref lookup rebuilds against the new tree.
  invalidateIndex(space.schema);

  if (input.initialState) {
    writeInitialState(space.schema.flat[id], input.initialState, false);
  }

  for (const child of input.children ?? []) {
    createElement(space, page, child, space.schema.flat[id], undefined);
  }
};

/** The idRef an element is wired by, minting one when it has none. Interactions are keyed by idRef, so an element
 *  that is about to host or be targeted by a flow must have one — rather than make the agent assign it with a
 *  separate patchElement, the MCP gives it a free `<type>-<n>` ref (unique across the space) and proceeds. An
 *  element that already has an idRef keeps it. Mutates the element in place and returns the ref. */
export const ensureIdRef = (space: Space, el: Element): string => {
  if (el.idRef) {
    return el.idRef;
  }

  const taken = FlatMap.takenIdRefs(space.schema.flat);
  el.idRef = makeIdRef(el.definition.type, candidate => taken.has(candidate));
  // The element is now addressable by a new idRef; the ref index must pick it up.
  invalidateIndex(space.schema);

  return el.idRef;
};

/** The key an interaction node must store to reach a target element. Every ref field also accepts a raw id, so a
 *  target given as an id is resolved to the element's idRef — the key the runtime registers callbacks under. A
 *  target that has no idRef is given one (see `ensureIdRef`), since it must be reachable to be wired to. A target
 *  that resolves to no element is left as written — it is already a ref, or a key only a plugin knows. */
export const resolveTargetRef = (space: Space, elementId: string): string => {
  const el = (space.schema.flat[elementId] as Element | undefined) ?? findElementByRef(space.schema, elementId);

  return el ? ensureIdRef(space, el) : elementId;
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
