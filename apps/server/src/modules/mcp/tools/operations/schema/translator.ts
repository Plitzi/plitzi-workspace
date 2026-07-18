import {
  bindingsToAI,
  computeVersion,
  descendantCount,
  descendantIds,
  elementById,
  elementRefOf,
  flowsFromInteractions,
  getPageElements,
  isPageElement,
  orderedChildren,
  pageFoldersOf,
  pageRefOf,
  pageRefOfElement,
  slugRouteParams
} from '../../../helpers';
import { definitionToAI, globalStylesForType, idStyleToAI } from '../style/translator';

import type {
  AIDefinition,
  AIElementDetail,
  AIFolder,
  AIGlobalStyle,
  AIInitialState,
  AIPageSkeleton,
  AIPageStyles,
  AIPageSummary,
  AISchemaVariable,
  AISettings,
  AISkeletonNode,
  AIStyleVariantSelection
} from '../../../types';
import type { Element, PageFolder, Schema, Style } from '@plitzi/sdk-shared';

// Read projections of the ELEMENT schema: page summaries, per-page skeleton trees, element detail, and vars.

const splitClasses = (value: string | undefined): string[] => (value ? value.split(/\s+/).filter(Boolean) : []);

const strOr = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const nameOf = (page: Element): string => strOr(page.attributes.name) ?? page.definition.label;

const propsOf = (el: Element): Record<string, unknown> | undefined => {
  const { subType, ...rest } = el.attributes;
  void subType;

  return Object.keys(rest).length > 0 ? rest : undefined;
};

const slotClasses = (selectors: Record<string, string>): Record<string, string[]> => {
  const slots: Record<string, string[]> = {};
  for (const [slot, classes] of Object.entries(selectors)) {
    if (slot !== 'base') {
      slots[slot] = splitClasses(classes);
    }
  }

  return slots;
};

// --- Navigation (cheap): page summaries and per-page skeleton trees, no props/style. ---

export const pageSummariesToAI = (schema: Schema): AIPageSummary[] =>
  getPageElements(schema).map(page => ({
    ref: pageRefOf(page),
    label: nameOf(page),
    slug: strOr(page.attributes.slug) ?? '',
    default: page.attributes.default === true,
    // Defaults to enabled: only an explicit `false` disables the page.
    enabled: page.attributes.enabled !== false,
    // Stored as '' for a root-level page; surface that as no folder so the agent only ever sees a real folder id.
    folder: strOr(page.attributes.folder) || undefined,
    elementCount: descendantCount(schema, page.id)
  }));

const folderToAI = (folder: PageFolder): AIFolder => ({
  ref: folder.id,
  name: folder.name,
  slug: folder.slug,
  parentId: folder.parentId
});

export const foldersToAI = (schema: Schema): AIFolder[] => pageFoldersOf(schema).map(folderToAI);

export const folderRefToAI = (schema: Schema, ref: string): AIFolder | undefined => {
  const folder = pageFoldersOf(schema).find(f => f.id === ref);

  return folder ? folderToAI(folder) : undefined;
};

// The per-node stateVersion is the SAME hash a direct element read (or a search hit) returns for that element, so an
// agent holding a page skeleton can diff node versions against what it cached and re-read only the changed elements.
// It needs the style to resolve each element exactly as elementDetailToAI does; without it the field is omitted.
const skeletonNode = (schema: Schema, el: Element, style?: Style): AISkeletonNode => {
  const children = orderedChildren(schema, el);
  const base = splitClasses(el.definition.styleSelectors.base);
  const slots = slotClasses(el.definition.styleSelectors);

  return {
    ref: elementRefOf(el),
    type: el.definition.type,
    label: el.definition.label,
    subType: strOr(el.attributes.subType),
    stateVersion: style ? computeVersion(elementDetailToAI(schema, el, style)) : undefined,
    base: base.length > 0 ? base : undefined,
    slots: Object.keys(slots).length > 0 ? slots : undefined,
    childCount: children.length,
    children: children.length > 0 ? children.map(child => skeletonNode(schema, child, style)) : undefined
  };
};

export const pageSkeletonToAI = (schema: Schema, pageEl: Element, style?: Style): AIPageSkeleton => {
  const slug = strOr(pageEl.attributes.slug) ?? '';

  return {
    ref: pageRefOf(pageEl),
    label: nameOf(pageEl),
    slug,
    default: pageEl.attributes.default === true,
    enabled: pageEl.attributes.enabled !== false,
    routeParams: slugRouteParams(slug),
    tree: orderedChildren(schema, pageEl).map(child => skeletonNode(schema, child, style))
  };
};

// All class refs an element attaches (base + every non-base slot), so a page-wide sweep can dedupe them.
const elementClassRefs = (el: Element): string[] => {
  const refs = splitClasses(el.definition.styleSelectors.base);
  for (const classes of Object.values(slotClasses(el.definition.styleSelectors))) {
    refs.push(...classes);
  }

  return refs;
};

export const pageStylesToAI = (schema: Schema, style: Style, pageEl: Element): AIPageStyles => {
  const classRefs = new Set<string>();
  const types = new Set<string>();
  const collect = (el: Element): void => {
    for (const ref of elementClassRefs(el)) {
      classRefs.add(ref);
    }

    types.add(el.definition.type);
  };

  collect(pageEl);
  for (const id of descendantIds(schema, pageEl.id)) {
    const el = elementById(schema, id);
    if (el) {
      collect(el);
    }
  }

  const definitions: AIDefinition[] = [];
  for (const ref of Array.from(classRefs).sort()) {
    const def = definitionToAI(style, ref);
    if (def) {
      definitions.push(def);
    }
  }

  const globalStyles: AIGlobalStyle[] = [];
  const seenGlobals = new Set<string>();
  for (const type of Array.from(types).sort()) {
    for (const global of globalStylesForType(style, type)) {
      if (!seenGlobals.has(global.ref)) {
        seenGlobals.add(global.ref);
        globalStyles.push(global);
      }
    }
  }

  return { ref: pageRefOf(pageEl), definitions, globalStyles };
};

// --- Detail (on demand): one element with its props and style. ---

// Inline the CSS of every definition the element attaches (base + slots), so an edit that only needs to see the
// current style does not have to follow up with a read of each definition (RFC 0005). Undefined when none resolve.
const resolveDefinitions = (
  style: Style,
  base: string[],
  slots: Record<string, string[]>
): Record<string, AIDefinition> | undefined => {
  const refs = new Set<string>(base);
  for (const classes of Object.values(slots)) {
    for (const cls of classes) {
      refs.add(cls);
    }
  }

  const resolved: Record<string, AIDefinition> = {};
  for (const ref of refs) {
    const def = definitionToAI(style, ref);
    if (def) {
      resolved[ref] = def;
    }
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
};

// The variant names a definition exposes, deduped across its base and every slot — so an element read can tell
// the agent a class HAS a variant (e.g. "primary") without a separate definition read.
const variantNamesOf = (def: AIDefinition): string[] => {
  const names = new Set<string>(Object.keys(def.variants ?? {}));
  for (const slot of Object.values(def.slots ?? {})) {
    for (const name of Object.keys(slot.variants ?? {})) {
      names.add(name);
    }
  }

  return [...names].sort();
};

const availableVariantsFrom = (
  resolvedStyle: Record<string, AIDefinition> | undefined
): Record<string, string[]> | undefined => {
  if (!resolvedStyle) {
    return undefined;
  }

  const result: Record<string, string[]> = {};
  for (const [ref, def] of Object.entries(resolvedStyle)) {
    const names = variantNamesOf(def);
    if (names.length > 0) {
      result[ref] = names;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

// Project the stored initialState down to the two fields agents set: which variant each class/selector uses, and
// initial visibility. Other keys (styleSelectors overrides, plugin-specific) are intentionally omitted here.
const initialStateToAI = (el: Element): AIInitialState | undefined => {
  const initialState = el.definition.initialState;
  if (!initialState) {
    return undefined;
  }

  const result: AIInitialState = {};
  if (initialState.styleVariant) {
    const styleVariant: AIStyleVariantSelection = {};
    for (const [cls, selectors] of Object.entries(initialState.styleVariant)) {
      if (!selectors) {
        continue;
      }

      const bySelector: Record<string, string | string[]> = {};
      for (const [selector, variant] of Object.entries(selectors)) {
        if (variant !== undefined) {
          bySelector[selector] = variant;
        }
      }

      if (Object.keys(bySelector).length > 0) {
        styleVariant[cls] = bySelector;
      }
    }

    if (Object.keys(styleVariant).length > 0) {
      result.styleVariant = styleVariant;
    }
  }

  if (typeof initialState.visibility === 'boolean') {
    result.visibility = initialState.visibility;
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

export const elementDetailToAI = (schema: Schema, el: Element, style?: Style): AIElementDetail => {
  const children = orderedChildren(schema, el);
  const parent = el.definition.parentId ? schema.flat[el.definition.parentId] : undefined;
  const base = splitClasses(el.definition.styleSelectors.base);
  const slots = slotClasses(el.definition.styleSelectors);

  const detail: AIElementDetail = {
    ref: elementRefOf(el),
    type: el.definition.type,
    subType: strOr(el.attributes.subType),
    label: el.definition.label,
    pageRef: pageRefOfElement(schema, el),
    parentRef: parent ? (isPageElement(schema, parent) ? pageRefOf(parent) : elementRefOf(parent)) : undefined,
    props: propsOf(el),
    style: { base, slots },
    childRefs: children.length > 0 ? children.map(elementRefOf) : undefined
  };

  const initialState = initialStateToAI(el);
  if (initialState) {
    detail.initialState = initialState;
  }

  const bindings = bindingsToAI(el.definition.bindings);
  if (bindings) {
    detail.bindings = bindings;
  }

  const interactions = flowsFromInteractions(el.definition.interactions);
  if (interactions.length > 0) {
    detail.interactions = interactions;
  }

  if (style) {
    const resolvedStyle = resolveDefinitions(style, base, slots);
    if (resolvedStyle) {
      detail.resolvedStyle = resolvedStyle;
      const availableVariants = availableVariantsFrom(resolvedStyle);
      if (availableVariants) {
        detail.availableVariants = availableVariants;
      }
    }

    const globalStyles = globalStylesForType(style, el.definition.type);
    if (globalStyles.length > 0) {
      detail.globalStyles = globalStyles;
    }

    const domId = strOr(el.attributes.id);
    if (domId) {
      const idStyle = idStyleToAI(style, domId);
      if (idStyle) {
        detail.idStyle = idStyle;
      }
    }
  }

  return detail;
};

// includeSubValues=false drops the per-variable conditional overrides — the cold-start primer only needs the
// names/values to know what {{name}} references exist; the full subValues are one dedicated read away.
export const schemaVariablesToAI = (schema: Schema, includeSubValues = true): Record<string, AISchemaVariable> => {
  const data: Record<string, AISchemaVariable> = {};

  for (const variable of schema.variables) {
    data[variable.name] = {
      name: variable.name,
      reference: `{{${variable.name}}}`,
      category: variable.category,
      type: variable.type,
      value: variable.value,
      subValues: includeSubValues ? variable.subValues.map(sv => ({ when: sv.when, value: sv.value })) : undefined
    };
  }

  return data;
};

// Space-level settings, projected as-is: the global CSS plus state/auth configuration. Only the keys actually
// present are returned, so a fresh space (no settings persisted) reads as an empty object rather than nulls.
export const settingsToAI = (schema: Schema): AISettings => {
  const result: AISettings = {};
  for (const [key, value] of Object.entries(schema.settings)) {
    result[key as keyof AISettings] = value as never;
  }

  return result;
};
