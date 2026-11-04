import { useRef } from 'react';

import { getBindingsDetails } from '@plitzi/sdk-shared/dataSource';
import { processTwig, hasValidToken, templatePaths } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { COMPONENT_PROPS_SOURCE } from '@plitzi/sdk-shared/schema';

import { useDrawnMemo } from './drawnMemo';
import { useStoreValues } from './storeValues';
import { dataSourceFrom, dataSourcePaths, sourceStorePath } from './useElementDataSource';
import useElementStateSetter, { emptyState } from './useElementState';
import useInternalItems from './useInternalItems';
import { serverTemplatesByType } from '../../elements/declarations';
import { isVisible } from '../helpers/isVisible';
import { omitKeys } from '../helpers/omitKeys';
import parseStyleSelectors from '../helpers/parseStyleSelectors';

import type { PathOf, StoreApi } from '@plitzi/nexus';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type { CommonState, Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { KeepEmptyTokens } from '@plitzi/sdk-shared/helpers/twigWrapper';
import type { ReactNode } from 'react';

type TwigValues = Record<string, unknown>;

/**
 * The attribute templates, resolved: `{{ list_rows.item.slug }}` in a link's `href`, `{{ state.name }}` in a text's
 * `content`.
 *
 * Resolved against the same sources a binding reads — every one the attribute names, subscribed by
 * `useElementInternal` — with the route and query params and the variables flattened beside them, as they always
 * were: a route param is `{{ slug }}`, a variable `{{ apiUrl }}`. `navigation` is the source with `origin` read off
 * the store, spelled the way a binding's template spells it.
 *
 * Only what was AUTHORED is a template — the caller names those keys. A value a binding put there is data — a
 * visitor's comment, a product name — and data that happens to contain `{{ auth.accessToken }}` must print those
 * characters, not evaluate them.
 */
/**
 * An empty token is kept for a later pass — `{{ redirect }}` before the query is read — except one reading a
 * component's props, which are all there when the tree renders: a prop the instance left out prints nothing, not its
 * own template.
 */
const KEEP_EMPTY_TOKENS: KeepEmptyTokens = { settled: new Set([COMPONENT_PROPS_SOURCE]) };

const interpolateAttributes = (
  attributes: Element['attributes'],
  templated: string[],
  dataSource: Record<string, unknown>
): Element['attributes'] => {
  const {
    queryParams = {},
    routeParams = {},
    variables = {},
    origin = '',
    navigation,
    ...sources
  } = dataSource as {
    queryParams?: TwigValues;
    routeParams?: TwigValues;
    variables?: TwigValues;
    origin?: string;
    navigation?: TwigValues;
  } & TwigValues;
  const data = {
    ...variables,
    ...routeParams,
    ...queryParams,
    ...sources,
    navigation: { ...navigation, routeParams, queryParams, origin }
  };
  const interpolated: Element['attributes'] = { ...attributes };
  for (const key of templated) {
    interpolated[key] = processTwig(attributes[key] as string, data, KEEP_EMPTY_TOKENS);
  }

  return interpolated;
};

const hasOwnKeys = (value: object): boolean => Object.keys(value).length > 0;

type Templated = { type: string; keys: string[] };

/**
 * The keys of these attributes that hold a template this element interpolates, kept per attributes object: the schema's
 * objects are replaced, never changed, when an element is edited, and the page server draws the same ones on every
 * request — each read the value of every attribute through the token check, on every element, each time.
 */
const templatedByAttributes = new WeakMap<Element['attributes'], Templated>();

const templatedKeysOf = (attributes: Element['attributes'], type: string): string[] => {
  const kept = templatedByAttributes.get(attributes);
  if (kept?.type === type) {
    return kept.keys;
  }

  const evaluatedElsewhere = serverTemplatesByType[type] ?? [];
  const keys = Object.keys(attributes).filter(key => {
    const value = attributes[key];

    return typeof value === 'string' && hasValidToken(value) && !evaluatedElsewhere.includes(key);
  });
  templatedByAttributes.set(attributes, { type, keys });

  return keys;
};

/**
 * A definition as an element draws with it when nothing at render time changes it — no binding rewrote it and its state
 * names no selectors: its classes laid over its selectors, its initial state's over those. Kept per definition object:
 * the page server draws the same schema on every request, and in the browser an element drawn again is handed the
 * definition it had, rather than a new one equal to it. One a binding made is drawn once and dropped with it.
 */
const drawnDefinitions = new WeakMap<Element['definition'], Element['definition']>();

const drawnDefinition = (
  definition: Element['definition'],
  stateSelectors: Element['definition']['styleSelectors'] | undefined,
  kept: boolean
): Element['definition'] => {
  const reusable = kept && stateSelectors === undefined;
  const known = reusable ? drawnDefinitions.get(definition) : undefined;
  if (known) {
    return known;
  }

  const drawn = {
    ...definition,
    styleSelectors: { ...definition.styleSelectors, ...definition.initialState?.styleSelectors, ...stateSelectors }
  };
  drawn.styleSelectors = parseStyleSelectors(drawn);
  if (reusable) {
    drawnDefinitions.set(definition, drawn);
  }

  return drawn;
};

const hasBindings = (bindings: Element['definition']['bindings']): boolean =>
  !!bindings && Object.values(bindings).some(list => Array.isArray(list) && list.length > 0);

export const getProps = (
  element: Element,
  internalProps: InternalPropsSTG1,
  dataSource = {} as Record<string, unknown>,
  state = {} as Record<string, unknown>
) => {
  let style: Record<string, string> | undefined = undefined;
  let { attributes, definition } = element;
  const { rootId, plitziElementLayout } = internalProps;
  // What the element is handed besides its identity — props another element injects — laid over its attributes.
  const injected = omitKeys(internalProps, ['id', 'rootId', 'attributes', 'definition', 'plitziElementLayout']);
  // Attribute injection, for example custom element (concat custom props + settings)
  if (internalProps.attributes) {
    attributes = { ...attributes, ...internalProps.attributes };
  }

  const authored = attributes;
  // Data Sources. Most elements bind nothing, and resolving no bindings is only the empty style it hands back.
  if (Object.keys(dataSource).length > 0) {
    if (hasBindings(definition.bindings)) {
      const bindingData = getBindingsDetails(
        dataSource as Record<string, RuleValue>,
        { ...element, attributes },
        style
      );
      ({ attributes, definition, style } = bindingData);
    } else {
      style = {};
    }
  }

  // Only what was authored with a template is interpolated, so an element with none — nearly every one — builds no
  // template data and copies no attributes: that was work on every element of every render, for nothing.
  // What the page server evaluates against its own context (a page's title over its providers) is left as written, and
  // a value a binding put in place of a template is data.
  const templated = templatedKeysOf(authored, definition.type).filter(key => attributes[key] === authored[key]);
  if (templated.length > 0) {
    attributes = interpolateAttributes(attributes, templated, dataSource);
  }

  // State: most elements hold none, and a copy of their attributes for nothing was one more for each of them.
  const hasState = Object.keys(state).length > 0;
  if (hasState) {
    attributes = { ...attributes, ...omitKeys(state, ['visibility', 'styleSelectors']) };
  }

  definition = drawnDefinition(
    definition,
    // An element's state is untyped (anything a flow writes); under `styleSelectors` it holds selectors, as it always did.
    state.styleSelectors as Element['definition']['styleSelectors'] | undefined,
    definition === element.definition
  );

  return {
    ...internalProps,
    rootId: plitziElementLayout ? plitziElementLayout.rootId : rootId,
    // A copy of their own, always — the state's above, or this one: never the schema's object, which every render of the
    // element shares.
    attributes: hasState && !hasOwnKeys(injected) ? attributes : { ...attributes, ...injected },
    definition,
    elementState: hasState ? { ...definition.initialState, ...state } : { ...definition.initialState },
    style
  };
};

const templatesIn = (attributes: Element['attributes'] | undefined, type: string): string[] =>
  // The keys `templatedKeysOf` gives are those whose value is a string.
  attributes ? templatedKeysOf(attributes, type).map(key => attributes[key] as string) : [];

/** Every source path an attribute's templates read, and the variables — which a template reads by their bare name. */
const templateSources = (templates: string[]): string[] => [
  'variables',
  ...new Set(templates.flatMap(template => templatePaths(template)))
];

/** What an element's own attributes' templates read, per attributes object as `templatedKeysOf` keeps its keys. */
const sourcesByAttributes = new WeakMap<Element['attributes'], { type: string; sources: string[] | undefined }>();

const templateSourcesOf = (
  attributes: Element['attributes'],
  injected: Element['attributes'] | undefined,
  type: string
): string[] | undefined => {
  const kept = injected ? undefined : sourcesByAttributes.get(attributes);
  if (kept?.type === type) {
    return kept.sources;
  }

  const templates = [...templatesIn(attributes, type), ...templatesIn(injected, type)];
  const sources = templates.length > 0 ? templateSources(templates) : undefined;
  if (!injected) {
    sourcesByAttributes.set(attributes, { type, sources });
  }

  return sources;
};

/** Stand-ins for what an element may not have, so every read below is kept by an object. */
const NO_BINDINGS: NonNullable<Element['definition']['bindings']> = {};
const NO_SOURCES: string[] = [];

/**
 * The source paths an element reads and where in the store each is, kept per bindings and per list of template sources:
 * both are the schema's own objects (or kept above), and the page server worked the two out again for every element of
 * every request — every binding's paths, a set of them, sorted, and a store path made for each.
 */
type SourceReads = { sourcePaths: string[]; storePaths: PathOf<CommonState>[] };

const readsByBindings = new WeakMap<object, WeakMap<string[], SourceReads>>();

const sourceReadsOf = (bindings: Element['definition']['bindings'], sources: string[] | undefined): SourceReads => {
  const byBindings = bindings ?? NO_BINDINGS;
  const bySources = sources ?? NO_SOURCES;
  const known = readsByBindings.get(byBindings) ?? new WeakMap<string[], SourceReads>();
  readsByBindings.set(byBindings, known);
  const kept = known.get(bySources);
  if (kept) {
    return kept;
  }

  const sourcePaths = dataSourcePaths(bindings, sources);
  // A source path names a key of `runtime.sources`, which is open: its store path is one the store's type cannot list.
  const reads = { sourcePaths, storePaths: sourcePaths.map(path => sourceStorePath(path) as PathOf<CommonState>) };
  known.set(bySources, reads);

  return reads;
};

export type UseElementInternalProps = {
  /** The nearest scope's store, which `withElement` read the element from: its other values are read from it too. */
  store: StoreApi<CommonState>;
  // The resolved element is read once by `withElement` and threaded in, so the element is subscribed to a single time
  // per instance instead of again here.
  element: Element;
  children?: ReactNode;
  internalProps: InternalPropsSTG1;
  previewMode?: boolean;
  /** Whether any ancestor is hiding this element — `withElement` has it before this element's own state is resolved. */
  parentVisible?: boolean;
};

const NAVIGATION_PATHS = ['navigation.routeParams', 'navigation.queryParams', 'navigation.origin'] as const;
const FLAGS_PATH = 'runtime.sources.flags';
const NO_FLAGS: Record<string, boolean> = {};

/**
 * Everything an element reads of the store besides itself, in one subscription: its state, the route and the query when
 * an attribute is a template (the only reader of them — subscribed for every element, they made the whole page render
 * again on each navigation), the sources its bindings and templates name, and the flags when it has items to gate. Read
 * one by one, these were four subscriptions on every element of a page, run whether they read anything or not: a fifth
 * of what drawing a page cost.
 */
type ElementReads = { paths: PathOf<CommonState>[]; sourcePaths: string[]; navigation: boolean; flags: boolean };

const sameValues = (previous: readonly unknown[], next: readonly unknown[]): boolean =>
  previous.length === next.length && previous.every((value, index) => Object.is(value, next[index]));

const elementReads = (
  statePath: PathOf<CommonState>,
  { sourcePaths, storePaths }: SourceReads,
  navigation: boolean,
  flags: boolean
): ElementReads => ({
  paths: [
    statePath,
    ...(navigation ? NAVIGATION_PATHS : []),
    ...storePaths,
    ...(flags ? [FLAGS_PATH as PathOf<CommonState>] : [])
  ],
  sourcePaths,
  navigation,
  flags
});

const useElementInternal = ({
  store,
  element,
  children,
  internalProps,
  previewMode = false,
  parentVisible = true
}: UseElementInternalProps) => {
  const { id } = internalProps;
  const { path: statePath, setElementState } = useElementStateSetter({
    store,
    id,
    bindings: element.definition.bindings,
    previewMode
  });
  const { type, bindings, items } = element.definition;
  const sources = useDrawnMemo(
    () => templateSourcesOf(element.attributes, internalProps.attributes, type),
    [element.attributes, internalProps.attributes, type]
  );
  const gatesItems = (items?.length ?? 0) > 0;
  const reads = useDrawnMemo(
    () => elementReads(statePath, sourceReadsOf(bindings, sources), sources !== undefined, gatesItems),
    [statePath, bindings, sources, gatesItems]
  );
  const values = useStoreValues(store, reads.paths);
  const state = (values[0] as Record<string, unknown> | undefined) ?? emptyState;
  const navigationAt = 1;
  const sourcesAt = navigationAt + (reads.navigation ? NAVIGATION_PATHS.length : 0);
  const [routeParams, queryParams, origin] = reads.navigation
    ? values.slice(navigationAt, sourcesAt)
    : [undefined, undefined, undefined];
  const flags = reads.flags
    ? ((values[values.length - 1] as Record<string, boolean> | undefined) ?? NO_FLAGS)
    : NO_FLAGS;
  // The sources' values alone, the same array while they are the same: read with the state, the whole list is a new one
  // whenever the state changes, and a data source made again from it renders the element's props again for nothing.
  const read = values.slice(sourcesAt, sourcesAt + reads.sourcePaths.length);
  const sourceValues = useRef(read);
  if (!sameValues(sourceValues.current, read)) {
    sourceValues.current = read;
  }

  const currentValues = sourceValues.current;
  const dataSource = useDrawnMemo(() => dataSourceFrom(reads.sourcePaths, currentValues), [reads, currentValues]);

  /**
   * What the element is drawn with, and what it is handed besides: the props its parent gave that are not the element's
   * own fields — the same keys of `internalProps`, read off it rather than off a copy made to add the setter.
   */
  const { internalPropsParsed, customProps } = useDrawnMemo(() => {
    const parsed = getProps(element, internalProps, { ...dataSource, routeParams, queryParams, origin }, state);

    return {
      // `getProps` hands back an object of its own: the setter joins it rather than copying it again.
      internalPropsParsed: Object.assign(parsed, { setElementState }),
      customProps: omitKeys(internalProps, [
        'id',
        'rootId',
        'plitziElementLayout',
        'attributes',
        'definition',
        'style',
        'elementState',
        'setElementState'
      ])
    };
  }, [element, internalProps, dataSource, routeParams, queryParams, origin, state, setElementState]);

  return {
    internalProps: internalPropsParsed,
    customProps,
    children: useInternalItems({
      id,
      store,
      flags,
      definition: internalPropsParsed.definition,
      plitziElementLayout: internalPropsParsed.plitziElementLayout,
      children,
      previewMode,
      visible: parentVisible && isVisible(internalPropsParsed.elementState.visibility)
    })
  };
};

export default useElementInternal;
