import { z } from 'zod';

import { StyleVariableCategory } from '../types/StyleTypes';

import type {
  DropPosition,
  Element,
  PageFolder,
  SchemaRaw,
  SchemaVariable,
  Style,
  StyleCategory,
  StyleItem,
  StyleVariableValue
} from '../types';

/**
 * The contract of the space live channel, in one place: the event names, the payload each one carries, and the
 * check that a payload really is what it claims. Both ends read it from here — the server names the event it
 * publishes, the builder names the event it handles — so the two cannot drift the way two parallel lists did.
 *
 * Deliberately a leaf module: it pulls zod and plain types, never the GraphQL documents, so a server importing the
 * vocabulary does not drag Apollo into its process.
 *
 * The heavy leaves (an element, a schema, a style variable) are NOT re-described here: they already have types, and
 * a second copy of them would be one more thing to drift. They are checked structurally — enough to catch a payload
 * of the wrong shape, which is the failure that actually happens — and keep their real type through `z.custom`.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const element = z.custom<Element>(value => isRecord(value) && typeof value.id === 'string', {
  message: 'expected an element with an id'
});

const elements = z.array(element);

// `flat` as a list is the wire shape of a schema. The builder re-indexes it on arrival, so the keyed map an MCP
// write works with is not interchangeable here — and that swap is exactly what this catches.
const schemaRaw = z.custom<SchemaRaw>(value => isRecord(value) && Array.isArray(value.flat), {
  message: 'expected a schema whose `flat` is a list of elements'
});

const pageFolder = z.custom<PageFolder>(value => isRecord(value) && typeof value.id === 'string', {
  message: 'expected a page folder with an id'
});

const schemaVariable = z.custom<SchemaVariable>(value => isRecord(value) && typeof value.name === 'string', {
  message: 'expected a variable with a name'
});

const styleAttributes = z.custom<StyleItem['attributes']>(isRecord, { message: 'expected a style attributes object' });

const styleVariableValue = z.custom<StyleVariableValue>(
  value => typeof value === 'string' || typeof value === 'number' || isRecord(value),
  { message: 'expected a style variable value' }
);

const displayMode = z.enum(['desktop', 'tablet', 'mobile']);
const dropPosition = z.custom<DropPosition>(value => typeof value === 'string', {
  message: 'expected a drop position'
});
const styleCategory = z.custom<StyleCategory>(value => typeof value === 'string', {
  message: 'expected a style category'
});
const tagType = z.enum(['class', 'element', 'id']);
const styleState = z.enum(['hover', 'active', 'focus', 'disabled', 'checked', 'visited']);
const variableCategory = z.enum(StyleVariableCategory);

const selectorParams = z.object({
  componentType: z.string().optional(),
  styleSelector: z.string().optional(),
  styleState: styleState.optional(),
  styleVariant: z.string().optional()
});

/** Updating a selector always names the one being updated; creating one does not have it yet. */
const selectorUpdateParams = selectorParams.extend({ styleSelector: z.string() });

/** What a segment edit carries on top of the space edit it mirrors: which segment it belongs to. */
const segmentScope = { contextId: z.string() };

const variablePayload = z.object({ variable: schemaVariable });
const selectorVariablePayload = z.object({
  displayMode,
  selector: z.string(),
  category: variableCategory,
  name: z.string(),
  value: styleVariableValue
});
const removeSelectorVariablePayload = z.object({
  displayMode,
  selector: z.string(),
  category: variableCategory,
  name: z.string()
});
const stylePayload = z.object({ category: variableCategory, name: z.string(), value: styleVariableValue });

export const spaceEventSchemas = {
  SPACE_UPDATED: z.object({ schema: schemaRaw }),
  // Not a whole Style: a style edit publishes the parts a live builder has to re-apply, plus the compiled cache,
  // and leaves mode/theme untouched.
  STYLE_UPDATED: z.object({
    platform: z.custom<Style['platform']>(isRecord),
    variables: z.custom<Style['variables']>(isRecord),
    cache: z.string()
  }),

  SPACE_ADD_PAGE: z.object({ page: element }),
  SPACE_UPDATE_PAGE: z.object({ page: element }),
  SPACE_SET_HOME_PAGE: z.object({ page: element }),
  SPACE_REMOVE_PAGE: z.object({ pageId: z.string() }),
  SPACE_ADD_PAGE_FOLDER: z.object({ pageFolder }),
  SPACE_UPDATE_PAGE_FOLDER: z.object({ pageFolder }),
  SPACE_REMOVE_PAGE_FOLDER: z.object({ pageFolderId: z.string() }),
  SPACE_ADD_VARIABLE: variablePayload,
  SPACE_UPDATE_VARIABLE: variablePayload,
  SPACE_REMOVE_VARIABLE: z.object({ name: z.string() }),
  SPACE_ADD_ELEMENT: z.object({
    element,
    dropPosition,
    to: z.string(),
    initialItems: elements.optional(),
    variables: z.array(schemaVariable).optional()
  }),
  SPACE_UPDATE_ELEMENT: z.object({ element }),
  // A rename travels as the two names, not as the elements it moved: an id is what the whole document points at, so
  // repointing it touches the parent's `items`, every binding source and every interaction target that named it —
  // and re-running that pass on the receiver is both smaller on the wire and exactly what the writer did.
  SPACE_RENAME_ELEMENT: z.object({ elementId: z.string(), id: z.string() }),
  SPACE_UPDATE_ELEMENTS: z.object({ elements }),
  SPACE_REMOVE_ELEMENT: z.object({ elementId: z.string() }),
  SPACE_MOVE_ELEMENT: z.object({ from: z.string(), to: z.string(), elementId: z.string(), dropPosition }),
  SPACE_CLONE_ELEMENT: z.object({ to: z.string(), element, dropPosition, initialItems: elements }),
  SPACE_ADD_TEMPLATE: z.object({
    element,
    style: z.custom<Style>(isRecord),
    to: z.string(),
    dropPosition,
    initialItems: elements.optional(),
    variables: z.array(schemaVariable).optional()
  }),
  SPACE_UPDATE_SETTINGS: z.object({ path: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }),

  STYLE_ADD_SELECTOR: z.object({
    displayMode,
    selector: z.string(),
    path: styleCategory.optional(),
    type: tagType,
    style: styleAttributes.optional(),
    params: selectorParams
  }),
  STYLE_UPDATE_SELECTOR: z.object({
    displayMode,
    selector: z.string(),
    path: styleCategory.optional(),
    style: styleAttributes.optional(),
    params: selectorUpdateParams
  }),
  STYLE_REMOVE_SELECTOR: z.object({ displayMode, selector: z.string() }),
  STYLE_REMOVE_SELECTORS: z.object({ displayMode, selectors: z.array(z.string()) }),
  STYLE_ADD_SELECTOR_VARIABLE: selectorVariablePayload,
  STYLE_UPDATE_SELECTOR_VARIABLE: selectorVariablePayload,
  STYLE_REMOVE_SELECTOR_VARIABLE: removeSelectorVariablePayload,
  STYLE_ADD_VARIABLE: stylePayload,
  STYLE_UPDATE_VARIABLE: stylePayload,
  STYLE_REMOVE_VARIABLE: z.object({ category: variableCategory, name: z.string() }),
  STYLE_UPDATE_SETTINGS: z.object({ path: z.string(), value: z.string() }),

  SEGMENT_ADD_ELEMENT: z.object({
    ...segmentScope,
    element,
    dropPosition,
    to: z.string(),
    initialItems: elements.optional(),
    variables: z.array(schemaVariable).optional()
  }),
  SEGMENT_UPDATE_ELEMENT: z.object({ ...segmentScope, element }),
  SEGMENT_RENAME_ELEMENT: z.object({ ...segmentScope, elementId: z.string(), id: z.string() }),
  SEGMENT_UPDATE_ELEMENTS: z.object({ ...segmentScope, elements }),
  SEGMENT_REMOVE_ELEMENT: z.object({ ...segmentScope, elementId: z.string() }),
  SEGMENT_MOVE_ELEMENT: z.object({
    ...segmentScope,
    elementId: z.string(),
    from: z.string(),
    to: z.string(),
    dropPosition
  }),
  SEGMENT_CLONE_ELEMENT: z.object({
    ...segmentScope,
    element,
    dropPosition,
    to: z.string(),
    initialItems: elements.optional()
  }),
  SEGMENT_ADD_TEMPLATE: z.object({
    ...segmentScope,
    element,
    style: z.custom<Style>(isRecord),
    to: z.string(),
    dropPosition,
    initialItems: elements.optional(),
    variables: z.array(schemaVariable).optional()
  }),
  SEGMENT_SPACE_ADD_VARIABLE: z.object({ ...segmentScope, variable: schemaVariable }),
  SEGMENT_SPACE_UPDATE_VARIABLE: z.object({ ...segmentScope, variable: schemaVariable }),
  // A removal only names the variable that went; there is no value left to send.
  SEGMENT_SPACE_REMOVE_VARIABLE: z.object({ ...segmentScope, variable: z.object({ name: z.string() }) }),
  SEGMENT_STYLE_ADD_SELECTOR: z.object({
    ...segmentScope,
    displayMode,
    selector: z.string(),
    type: tagType,
    path: styleCategory.optional(),
    style: styleAttributes.optional(),
    params: selectorParams
  }),
  SEGMENT_STYLE_UPDATE_SELECTOR: z.object({
    ...segmentScope,
    displayMode,
    selector: z.string(),
    path: styleCategory.optional(),
    style: styleAttributes.optional(),
    params: selectorUpdateParams
  }),
  SEGMENT_STYLE_REMOVE_SELECTOR: z.object({ ...segmentScope, displayMode, selector: z.string() }),
  SEGMENT_STYLE_REMOVE_SELECTORS: z.object({ ...segmentScope, displayMode, selectors: z.array(z.string()) }),
  SEGMENT_STYLE_ADD_SELECTOR_VARIABLE: selectorVariablePayload.extend(segmentScope),
  SEGMENT_STYLE_UPDATE_SELECTOR_VARIABLE: selectorVariablePayload.extend(segmentScope),
  SEGMENT_STYLE_REMOVE_SELECTOR_VARIABLE: removeSelectorVariablePayload.extend(segmentScope),
  SEGMENT_STYLE_ADD_VARIABLE: stylePayload.extend(segmentScope),
  SEGMENT_STYLE_UPDATE_VARIABLE: stylePayload.extend(segmentScope),
  SEGMENT_STYLE_REMOVE_VARIABLE: z.object({ ...segmentScope, category: variableCategory, name: z.string() })
} as const;

export type SpaceEventName = keyof typeof spaceEventSchemas;

/** The payload each event carries, inferred from its schema so there is no second definition to keep in step. */
export type SpaceEventMap = { [K in SpaceEventName]: z.infer<(typeof spaceEventSchemas)[K]> };

/** The event names as values, for the publisher — the same list as the schemas, never a copy of it. */
export const SpaceEvents = Object.fromEntries(Object.keys(spaceEventSchemas).map(event => [event, event])) as {
  [K in SpaceEventName]: K;
};

export type SpaceEventIssue = { path: string; message: string };

export type SpaceEventValidation<T extends SpaceEventName> =
  { ok: true; data: SpaceEventMap[T] } | { ok: false; issues: SpaceEventIssue[] };

/**
 * Checks a payload against the event it claims to be. The wire is JSON, so nothing above this line proves what
 * arrived: the compiler agrees with both ends only for the build they were compiled in, and a session talking to a
 * server of another version is exactly where it stops being true.
 */
export const validateSpaceEvent = <T extends SpaceEventName>(event: T, data: unknown): SpaceEventValidation<T> => {
  // Indexing a record of differently-shaped schemas by a generic key gives their union, which TypeScript cannot
  // relate back to `SpaceEventMap[T]` — the two are the same thing by construction, but only the map says so.
  const schema = spaceEventSchemas[event] as unknown as z.ZodType<SpaceEventMap[T]> | undefined;
  if (!schema) {
    return { ok: false, issues: [{ path: '', message: `Unknown space event "${event}"` }] };
  }

  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    issues: result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
  };
};

export default SpaceEvents;
