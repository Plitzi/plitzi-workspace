import get from 'lodash-es/get';
import omit from 'lodash-es/omit';
import { useMemo } from 'react';

import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/helpers/twigWrapper';

import useElementState from './useElementState';

import type { Element, InternalPropsSTG1, InternalPropsSTG2 } from '@plitzi/sdk-shared';

// Methods

const getProps = (
  element: Partial<Element> & { attributes: Element['attributes']; definition: Element['definition'] },
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
    const bindingData = getBindingsDetails(dataSource, attributes, definition, style);
    ({ attributes, definition, style } = bindingData);
  }

  // Variables
  const { variables } = dataSource;
  if (variables && Object.keys(variables).length > 0) {
    attributes = Object.keys(attributes).reduce((acum, key) => {
      if (typeof attributes[key] === 'string' && hasTokens(attributes[key])) {
        return { ...acum, [key]: processTwig(attributes[key], variables as Record<string, unknown>, true) };
      }

      return { ...acum, [key]: attributes[key] };
    }, {});
  }

  // State
  attributes = { ...attributes, ...omit(state, ['visibility', 'styleSelectors']) };
  definition = {
    ...definition,
    styleSelectors: {
      ...definition.styleSelectors,
      ...definition.initialState?.styleSelectors,
      ...(state.styleSelectors ?? {})
    }
  };
  const elementState = { ...definition.initialState, ...state };

  return {
    ...internalProps,
    rootId: get(plitziElementLayout, 'rootId', rootId),
    attributes: {
      ...attributes,
      ...omit(internalProps, ['id', 'rootId', 'attributes', 'definition', 'plitziElementLayout'])
    },
    definition,
    elementState,
    style
  };
};

export type UseInternalProps = {
  element: Partial<Element> & { attributes: Element['attributes']; definition: Element['definition'] };
  internalProps: InternalPropsSTG1;
  dataSource: Record<string, unknown>;
  previewMode?: boolean;
};

const useInternalProps = ({ element, internalProps, dataSource, previewMode = false }: UseInternalProps) => {
  const { state, setElementState } = useElementState({ bindings: element.definition.bindings, previewMode });
  const internalPropsParsed = useMemo<InternalPropsSTG2>(() => {
    const internalPropsAux = getProps(element, internalProps, dataSource, state);

    return { ...internalPropsAux, setElementState };
  }, [element, internalProps, dataSource, state, setElementState]);

  return { internalProps: internalPropsParsed, children: undefined };
};

export default useInternalProps;
