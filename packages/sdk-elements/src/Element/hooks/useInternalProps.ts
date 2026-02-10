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
  style: Record<string, string> = {} as Record<string, string>,
  dataSource = {} as Record<string, unknown>
) => {
  let { attributes, definition } = element;
  const { rootId, plitziElementLayout } = internalProps;
  if (internalProps.attributes) {
    // Attribute injection, for example custom element (concat custom props + settings)
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

  return {
    ...internalProps,
    rootId: get(plitziElementLayout, 'rootId', rootId),
    attributes: {
      ...attributes,
      ...omit(internalProps, ['id', 'rootId', 'attributes', 'definition', 'plitziElementLayout'])
    },
    definition: {
      ...definition,
      styleSelectors: { ...definition.styleSelectors, ...definition.initialState?.styleSelectors }
    },
    interactions: get(definition, 'interactions', {}),
    styleSelectors: get(definition, 'styleSelectors', {}),
    style
  };
};

export type UseInternalProps = {
  element: Partial<Element> & { attributes: Element['attributes']; definition: Element['definition'] };
  internalProps: InternalPropsSTG1;
  dataSource: Record<string, unknown>;
  previewMode?: boolean;
  style?: Record<string, string>;
};

const useInternalProps = ({ element, internalProps, dataSource, previewMode = false, style }: UseInternalProps) => {
  const { state, setElementState } = useElementState({ bindings: element.definition.bindings, previewMode });

  const internalPropsParsed = useMemo<InternalPropsSTG2>(() => {
    const internalPropsAux = getProps(element, internalProps, style, dataSource);
    const { attributes, definition } = internalPropsAux;

    return {
      ...internalPropsAux,
      attributes: { ...attributes, ...omit(state, ['visibility', 'styleSelectors']) },
      definition: { ...definition, styleSelectors: { ...definition.styleSelectors, ...(state.styleSelectors ?? {}) } },
      elementState: { ...definition.initialState, ...state },
      setElementState
    };
  }, [element, style, internalProps, dataSource, state, setElementState]);

  return { internalProps: internalPropsParsed, children: undefined, className: '' };
};

export default useInternalProps;
