import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import { processTwig, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import useElementDataSource from './useElementDataSource';
import useElementState from './useElementState';
import useInternalItems from './useInternalItems';
import getBindingsDetails from '../../dataSource/getBindingsDetails';
import { omitKeys } from '../helpers/omitKeys';
import parseStyleSelectors from '../helpers/parseStyleSelectors';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type { Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

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

  // Variables
  const { variables } = dataSource;
  if (variables && Object.keys(variables).length > 0) {
    const interpolated: Element['attributes'] = {};
    for (const key of Object.keys(attributes)) {
      const value = attributes[key];
      interpolated[key] =
        typeof value === 'string' && hasValidToken(value)
          ? processTwig(value, variables as Record<string, unknown>, true)
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

export type UseElementInternalProps = {
  // The resolved element is read once by `withElement` and threaded in, so the element is subscribed to a single time
  // per instance instead of again here.
  element: Element;
  children?: ReactNode;
  internalProps: InternalPropsSTG1;
  previewMode?: boolean;
};

const useElementInternal = ({ element, children, internalProps, previewMode = false }: UseElementInternalProps) => {
  const { id } = internalProps;
  const { state, setElementState } = useElementState({ bindings: element.definition.bindings, previewMode });
  const dataSource = useElementDataSource({ bindings: element.definition.bindings, sources: ['variables'] });

  const internalPropsParsed = useMemo(
    () => ({ ...getProps(element, internalProps, dataSource, state), setElementState }),
    [element, internalProps, dataSource, state, setElementState]
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
      previewMode
    })
  };
};

export default useElementInternal;
