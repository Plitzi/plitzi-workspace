import { produce } from 'immer';
import get from 'lodash-es/get';
import omit from 'lodash-es/omit';
import set from 'lodash-es/set';
import { useMemo, useCallback, useRef } from 'react';

import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/helpers/twigWrapper';

import useElementState from './useElementState';
import getInteractions from '../helpers/getInteractions';

import type {
  Element,
  InteractionCallbackParamValues,
  InteractionPostCallback,
  InternalPropsSTG1,
  InternalPropsSTG2
} from '@plitzi/sdk-shared';

// Helpers

const sanityValue = (value: string | boolean | number) => {
  if (typeof value !== 'string') {
    return value;
  }

  const valueParsed = value.toLowerCase();
  if (valueParsed === 'true' || valueParsed === 'false' || valueParsed === 'yes' || valueParsed === 'no') {
    return valueParsed === 'true' || valueParsed === 'yes';
  }

  return value;
};

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
  const prevStateRef = useRef<Record<string, unknown>>({});
  const { state, setState, setElementState } = useElementState({ bindings: element.definition.bindings, previewMode });

  const setStateCallback = useCallback(
    (params: InteractionCallbackParamValues) => {
      const prevState = prevStateRef.current;
      if (!params.key || !params.value) {
        return { prevState, nextState: prevState };
      }

      const { key } = params;
      let { value } = params;
      value = sanityValue(value as string | number | boolean);
      let newState = {};
      if (typeof value === 'undefined') {
        newState = omit(prevState, [key as string]);
      } else {
        newState = produce(prevState, draft => set(draft, key as string, value));
      }

      if (setElementState(newState)) {
        prevStateRef.current = newState;

        return { prevState, nextState: newState };
      }

      return { prevState, nextState: prevState };
    },
    [setElementState]
  );

  const setStatePostCallback: InteractionPostCallback = useCallback(
    (params, callbackResult) => {
      const { revertOnFinish } = params;
      if (
        !revertOnFinish ||
        !callbackResult ||
        !(callbackResult as { prevState: Record<string, unknown> | undefined }).prevState
      ) {
        return;
      }

      const { prevState } = callbackResult as { prevState: Record<string, unknown> };
      prevStateRef.current = prevState;
      setState(prevState);
    },
    [setState]
  );

  const internalPropsParsed = useMemo<InternalPropsSTG2>(() => {
    const internalPropsAux = getProps(element, internalProps, style, dataSource);
    const { attributes, definition } = internalPropsAux;

    return {
      ...internalPropsAux,
      attributes: { ...attributes, ...omit(state, ['visibility', 'styleSelectors']) },
      definition: { ...definition, styleSelectors: { ...definition.styleSelectors, ...(state.styleSelectors ?? {}) } },
      elementState: { ...definition.initialState, ...state },
      setElementState,
      interactionsBasicCallbacks: getInteractions(attributes, definition, setStateCallback, setStatePostCallback)
    };
  }, [element, style, internalProps, dataSource, state, setElementState, setStateCallback, setStatePostCallback]);

  return { internalProps: internalPropsParsed, children: undefined, className: '' };
};

export default useInternalProps;
