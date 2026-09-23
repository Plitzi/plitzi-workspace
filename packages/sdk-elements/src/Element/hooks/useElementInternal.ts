import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import getBindingsDetails from '@plitzi/sdk-shared/dataSource/getBindingsDetails';
import { processTwig, hasValidToken, templateRootNames } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import useElementDataSource from './useElementDataSource';
import useElementState from './useElementState';
import useInternalItems from './useInternalItems';
import { isVisible } from '../helpers/isVisible';
import { omitKeys } from '../helpers/omitKeys';
import parseStyleSelectors from '../helpers/parseStyleSelectors';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type { Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

type TwigValues = Record<string, unknown>;

export const getProps = (
  element: Element,
  internalProps: InternalPropsSTG1,
  dataSource = {} as Record<string, unknown>,
  state = {} as Record<string, unknown>
) => {
  let style: Record<string, string> | undefined = undefined;
  let { attributes, definition } = element;
  const { rootId, plitziElementLayout } = internalProps;
  // Attribute injection, for example custom element (concat custom props + settings)
  if (internalProps.attributes) {
    attributes = { ...attributes, ...internalProps.attributes };
  }

  const authored = attributes;
  // Data Sources
  if (Object.keys(dataSource).length > 0) {
    const bindingData = getBindingsDetails(dataSource as Record<string, RuleValue>, { ...element, attributes }, style);
    ({ attributes, definition, style } = bindingData);
  }

  /**
   * Attribute templates: `{{ list_rows.item.slug }}` in a link's `href`, `{{ state.name }}` in a text's `content`.
   *
   * Resolved against the same sources a binding reads — every one the attribute names, subscribed by
   * `useElementInternal` — with the route and query params and the variables flattened beside them, as they always
   * were: a route param is `{{ slug }}`, a variable `{{ apiUrl }}`. Until the sources were here an attribute saw only
   * that flattened half, and a card linking to `/games/{{ list_games.item.slug }}` linked to that text, literally.
   *
   * `navigation` is the source with `origin` read off the store, spelled the way a binding's template spells it.
   *
   * Only what was AUTHORED is a template. A value a binding put there is data — a visitor's comment, a product name —
   * and data that happens to contain `{{ auth.accessToken }}` must print those characters, not evaluate them.
   */
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
  if (Object.keys(data).length > 0) {
    const interpolated: Element['attributes'] = {};
    for (const key of Object.keys(attributes)) {
      const value = attributes[key];
      interpolated[key] =
        typeof value === 'string' && value === authored[key] && hasValidToken(value)
          ? processTwig(value, data, true)
          : value;
    }

    attributes = interpolated;
  }

  // State
  attributes = { ...attributes, ...omitKeys(state, ['visibility', 'styleSelectors']) };
  definition = {
    ...definition,
    styleSelectors: {
      ...definition.styleSelectors,
      ...definition.initialState?.styleSelectors,
      ...(state.styleSelectors ?? {})
    }
  };

  // StyleSelectors now will include the component class
  definition.styleSelectors = parseStyleSelectors(definition);

  return {
    ...internalProps,
    rootId: get(plitziElementLayout, 'rootId', rootId),
    attributes: {
      ...attributes,
      ...omitKeys(internalProps, ['id', 'rootId', 'attributes', 'definition', 'plitziElementLayout'])
    },
    definition,
    elementState: { ...definition.initialState, ...state },
    style
  };
};

const templatesIn = (attributes: Record<string, unknown> | undefined): string[] =>
  Object.values(attributes ?? {}).filter((value): value is string => typeof value === 'string' && hasValidToken(value));

/** Every source an attribute's templates name, and the variables — which a template reads by their bare name. */
const templateSources = (templates: string[]): string[] => [
  'variables',
  ...new Set(templates.flatMap(template => templateRootNames(template)))
];

export type UseElementInternalProps = {
  // The resolved element is read once by `withElement` and threaded in, so the element is subscribed to a single time
  // per instance instead of again here.
  element: Element;
  children?: ReactNode;
  internalProps: InternalPropsSTG1;
  previewMode?: boolean;
  /** Whether any ancestor is hiding this element — `withElement` has it before this element's own state is resolved. */
  parentVisible?: boolean;
};

const useElementInternal = ({
  element,
  children,
  internalProps,
  previewMode = false,
  parentVisible = true
}: UseElementInternalProps) => {
  const { id } = internalProps;
  const { state, setElementState } = useElementState({ id, bindings: element.definition.bindings, previewMode });
  /**
   * Whether any attribute is a template — the only reader of the route, the query and the variables below.
   *
   * Subscribed for every element, those made the whole page render again on each navigation, templates or not: a
   * route change writes new params and new variables, and every element on the page was listening.
   */
  const sources = useMemo(() => {
    const templates = [...templatesIn(element.attributes), ...templatesIn(internalProps.attributes)];

    return templates.length > 0 ? templateSources(templates) : undefined;
  }, [element.attributes, internalProps.attributes]);
  const usesTemplates = sources !== undefined;
  const [[routeParams, queryParams, origin]] = useCommonStore(
    ['navigation.routeParams', 'navigation.queryParams', 'navigation.origin'],
    { enabled: usesTemplates }
  );
  const dataSource = useElementDataSource({
    bindings: element.definition.bindings,
    sources
  });

  const internalPropsParsed = useMemo(
    () => ({
      ...getProps(element, internalProps, { ...dataSource, routeParams, queryParams, origin }, state),
      setElementState
    }),
    [element, internalProps, dataSource, routeParams, queryParams, origin, state, setElementState]
  );

  return {
    internalProps: internalPropsParsed,
    customProps: omitKeys(internalPropsParsed, [
      'id',
      'rootId',
      'plitziElementLayout',
      'attributes',
      'definition',
      'style',
      'elementState',
      'setElementState'
    ]),
    children: useInternalItems({
      id,
      definition: internalPropsParsed.definition,
      plitziElementLayout: internalPropsParsed.plitziElementLayout,
      children,
      previewMode,
      visible: parentVisible && isVisible(internalPropsParsed.elementState.visibility)
    })
  };
};

export default useElementInternal;
