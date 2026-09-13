import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import getBindingsDetails from '@plitzi/sdk-shared/dataSource/getBindingsDetails';
import { processTwig, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';
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

  // Data Sources
  if (Object.keys(dataSource).length > 0) {
    const bindingData = getBindingsDetails(dataSource as Record<string, RuleValue>, { ...element, attributes }, style);
    ({ attributes, definition, style } = bindingData);
  }

  /**
   * Variables and navigation params injection, for example twig interpolation.
   *
   * The flattened half is what it has always been: a route param is `{{ slug }}`, a variable is `{{ apiUrl }}`.
   * `navigation` is published BESIDE it, under its own name, because the one thing an attribute could not say was
   * where it is — `origin` has a port and `hostname` does not, so a link that sends somebody back to this page had
   * to name each environment's address in a variable of its own. Spelled the way every other source is
   * (`{{ navigation.origin }}`), so the vocabulary is the same one a binding's template already uses.
   */
  const {
    queryParams = {},
    routeParams = {},
    variables = {},
    origin = ''
  } = dataSource as { queryParams?: TwigValues; routeParams?: TwigValues; variables?: TwigValues; origin?: string };
  const data = { ...variables, ...routeParams, ...queryParams, navigation: { routeParams, queryParams, origin } };
  if (Object.keys(data).length > 0) {
    const interpolated: Element['attributes'] = {};
    for (const key of Object.keys(attributes)) {
      const value = attributes[key];
      interpolated[key] = typeof value === 'string' && hasValidToken(value) ? processTwig(value, data, true) : value;
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
  const [[routeParams, queryParams, origin]] = useCommonStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.origin'
  ]);
  const dataSource = useElementDataSource({ bindings: element.definition.bindings, sources: ['variables'] });

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
