import { produce } from 'immer';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';
import omit from 'lodash/omit';
import set from 'lodash/set';
import { useMemo, useState, useCallback, useRef } from 'react';

import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/twigWrapper';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import type { InternalProps } from '../../types/ElementTypes';
import type { Element, ElementBinding, InteractionCallback } from '@plitzi/sdk-shared';
import { EventBridgeCallback } from '@plitzi/sdk-event-bridge';

// Helpers

const getCache = (definition: Element['definition']) => {
  const bindingsState = get(definition, 'bindings.initialState', []) as ElementBinding[];
  let stateBinded: string[] = [];
  if (Array.isArray(bindingsState)) {
    stateBinded = bindingsState.map(binding => get(binding, 'toPath', ''));
  }

  const bindingsAttributes = get(definition, 'bindings.attributes', []) as ElementBinding[];
  let attributesBinded: string[] = [];
  if (Array.isArray(bindingsAttributes)) {
    attributesBinded = bindingsAttributes.map(binding => get(binding, 'toPath', ''));
  }

  return { stateBinded, attributesBinded };
};

const sanityValue = (value: string | boolean | number) => {
  if (value === 'true' || value === 'false' || value === 'yes' || value === 'no') {
    value = value === 'true' || value === 'yes';
  }

  return value;
};

// Methods

const getProps = (
  element: Partial<Element>,
  internalProps: InternalProps = {} as InternalProps,
  plitziCustomComponent = false,
  dataSource = {}
) => {
  let { attributes, definition } = element;
  const { attributes: attributesProp, rootId, plitziElementLayout } = internalProps;
  if (plitziCustomComponent) {
    attributes = omit({ ...attributes, ...attributesProp }, ['settings']);
  }

  // Data Sources
  let style = {};
  if (Object.keys(dataSource).length > 0) {
    const bindingData = getBindingsDetails(dataSource, attributes, definition);
    ({ attributes, definition, style } = bindingData);
  }

  // Variables
  const { variables } = dataSource;
  if (variables && Object.keys(variables).length > 0) {
    attributes = Object.keys(attributes).reduce((acum, key) => {
      if (typeof attributes[key] === 'string' && hasTokens(attributes[key])) {
        return { ...acum, [key]: processTwig(attributes[key], variables, true) };
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

const getInteractions = (
  attributes: Element['attributes'],
  definition: Element['definition'],
  callback: InteractionCallback,
  postCallback
) => ({
  setState: {
    title: `Update ${definition.label}`,
    callback,
    postCallback,
    preview: {},
    params: {
      category: {
        label: 'Category',
        defaultValue: 'attribute',
        type: 'select',
        options: [
          { value: 'attribute', label: 'Attribute' },
          { value: 'state', label: 'State' }
        ]
      },
      key: {
        label: 'Key',
        defaultValue: undefined,
        type: 'select',
        when: params => params.category === 'attribute' || params.category === 'state',
        options: params => {
          const { category } = params;
          if (category === 'attribute') {
            return Object.keys(attributes).map(attribute => ({ value: attribute, label: attribute }));
          }

          if (category === 'state') {
            return [
              { path: 'visibility', label: 'Visibility' },
              ...Object.keys(definition.styleSelectors).map(styleSelector => ({
                value: `styleSelectors.${styleSelector}`,
                label: `Selector - ${capitalize(styleSelector)}`
              }))
            ];
          }

          return [];
        }
      },
      value: {
        label: 'Value',
        defaultValue: undefined,
        type: params => {
          if (typeof attributes[params.key] === 'boolean') {
            return 'select';
          }

          return 'text';
        },
        when: params => !!params.category,
        options: params => {
          const { key } = params;
          if (typeof attributes[key] === 'boolean') {
            return [
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' }
            ];
          }

          return Object.keys(attributes).map(attribute => ({ value: attribute, label: attribute }));
        }
      },
      revertOnFinish: {
        label: 'Revert changes after interaction',
        defaultValue: false,
        type: 'boolean'
      }
    }
  }
});

export type UseInternalProps = {
  element: Partial<Element>;
  internalProps: InternalProps;
  plitziCustomComponent?: boolean;
  dataSource: object;
  previewMode?: boolean;
};

const useInternalProps = ({
  element,
  internalProps = emptyObject as InternalProps,
  plitziCustomComponent = false,
  dataSource = emptyObject,
  previewMode = false
}: UseInternalProps) => {
  const prevStateRef = useRef({});
  const [state, setState] = useState({});
  const { definition } = internalProps;
  const cache = useMemo(() => getCache(definition), [definition]);

  const setElementState: EventBridgeCallback = useCallback(
    (params?: (() => Record<string, unknown>) | { key?: string; value?: string | boolean | number }) => {
      if (!previewMode || !params || (typeof params !== 'object' && typeof params !== 'function')) {
        return false;
      }

      // Scenario 1 when is a function
      if (typeof params === 'function') {
        setState(prevState => produce(prevState, draft => omit(params(draft) ?? {}, cache.attributesBinded)));

        return true;
      }

      // Scenario 2 when is an object (key / value)
      if (params.key && params.value !== undefined) {
        const { key } = params;
        let { value } = params;
        value = sanityValue(value);
        setState(prevState =>
          produce(prevState, draft => {
            if (typeof value === 'boolean' || value || value === '' || value === 0) {
              set(draft, key, value);
            } else {
              draft = omit(draft, [key]);
            }
          })
        );

        return true;
      }

      // Scenario 3, its an object
      const auxState = {};
      Object.keys(params).forEach(key => {
        set(auxState, key, params[key]);
      });

      setState(omit(auxState, cache.attributesBinded));

      return true;
    },
    [cache, previewMode]
  );

  const setStateCallback = useCallback(
    params => {
      const prevState = prevStateRef.current;
      if (!params || !params.key || !params.value) {
        return { prevState, nextState: prevState };
      }

      const { key } = params;
      let { value } = params;
      value = sanityValue(value);
      let newState = {};
      if (typeof value === 'boolean' || value || value === '' || value === 0) {
        newState = produce(prevState, draft => set(draft, key, value));
      } else {
        newState = omit(prevState, [key]);
      }

      if (setElementState(newState)) {
        prevStateRef.current = newState;

        return { prevState, nextState: newState };
      }

      return { prevState, nextState: prevState };
    },
    [setElementState]
  );

  const setStatePostCallback = useCallback((params, callbackResult) => {
    const { revertOnFinish } = params;
    if (!revertOnFinish || !callbackResult || !callbackResult?.prevState) {
      return;
    }

    const { prevState } = callbackResult;
    prevStateRef.current = prevState;
    setState(prevState);
  }, []);

  const internalPropsParsed = useMemo<InternalProps & { setElementState: typeof setElementState }>(() => {
    const internalPropsAux = getProps(element, internalProps, plitziCustomComponent, dataSource);
    const { attributes, definition } = internalPropsAux;

    return {
      ...internalPropsAux,
      attributes: { ...attributes, ...omit(state, ['visibility', 'styleSelectors']) },
      definition: { ...definition, styleSelectors: { ...definition?.styleSelectors, ...state?.styleSelectors } },
      elementState: { ...definition.initialState, ...state },
      setElementState,
      interactionsBasicCallbacks: getInteractions(attributes, definition, setStateCallback, setStatePostCallback)
    };
  }, [
    element.definition,
    element.attributes,
    internalProps,
    plitziCustomComponent,
    state,
    setElementState,
    setStateCallback,
    setStatePostCallback,
    dataSource
  ]);

  return { internalProps: internalPropsParsed, children: undefined, className: '' };
};

export default useInternalProps;
