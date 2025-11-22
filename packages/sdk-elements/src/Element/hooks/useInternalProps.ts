import { produce } from 'immer';
import capitalize from 'lodash-es/capitalize.js';
import get from 'lodash-es/get.js';
import omit from 'lodash-es/omit.js';
import set from 'lodash-es/set.js';
import { useMemo, useState, useCallback, useRef } from 'react';

import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/helpers/twigWrapper';

import type {
  Element,
  ElementBinding,
  InteractionBaseCallback,
  InteractionCallback,
  InteractionCallbackParamValues,
  InteractionPostCallback,
  InternalPropsSTG1,
  InternalPropsSTG2
} from '@plitzi/sdk-shared';

// Helpers

const getCache = (definition?: Element['definition']) => {
  if (!definition) {
    return { stateBinded: [], attributesBinded: [] };
  }

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
  element: Partial<Element> & { attributes: Element['attributes']; definition: Element['definition'] },
  internalProps: InternalPropsSTG1,
  style: Record<string, string> = {} as Record<string, string>,
  plitziCustomComponent = false,
  dataSource = {} as Record<string, unknown>
) => {
  let { attributes, definition } = element;
  const { rootId, plitziElementLayout } = internalProps;
  if (plitziCustomComponent) {
    attributes = omit(attributes, ['settings']);
  }

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

const getInteractions = (
  attributes: Element['attributes'],
  definition: Element['definition'],
  callback: InteractionCallback['callback'],
  postCallback: InteractionPostCallback
): Record<string, InteractionBaseCallback> => ({
  setState: {
    action: 'setState',
    title: `Update ${definition.label}`,
    type: 'callback',
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
              { value: 'visibility', label: 'Visibility' },
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
        type: params => (typeof attributes[params.key as string] === 'boolean' ? 'select' : 'text'),
        when: params => !!params.category,
        options: params => {
          const { key } = params;
          if (typeof attributes[key as string] === 'boolean') {
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
  element: Partial<Element> & { attributes: Element['attributes']; definition: Element['definition'] };
  internalProps: InternalPropsSTG1;
  plitziCustomComponent?: boolean;
  dataSource: Record<string, unknown>;
  previewMode?: boolean;
  style?: Record<string, string>;
};

const useInternalProps = ({
  element,
  internalProps,
  plitziCustomComponent = false,
  dataSource,
  previewMode = false,
  style
}: UseInternalProps) => {
  const prevStateRef = useRef<Record<string, unknown>>({});
  const [state, setState] = useState<Record<string, unknown>>({});
  const cache = useMemo(() => getCache(element.definition), [element.definition]);

  const setElementState = useCallback(
    <T extends Record<string, unknown> = Record<string, unknown>>(
      params?: ((state: T) => T) | { key: string; value?: string | boolean | number } | T
    ) => {
      if (!previewMode || !params || (typeof params !== 'object' && typeof params !== 'function')) {
        return false;
      }

      // Scenario 1 when is a function
      if (typeof params === 'function') {
        setState(prevState =>
          produce(prevState, draft => {
            const result = params(draft as T);
            if (!(result as T | undefined) || typeof result !== 'object') {
              return;
            }

            omit(result, cache.attributesBinded);

            return { ...draft, ...result };
          })
        );

        return true;
      }

      // Scenario 2 when is an object (key / value)
      if (params.key && params.value !== undefined) {
        const { key } = params;
        let { value } = params;
        value = sanityValue(value as string | boolean | number);
        setState(prevState =>
          produce(prevState, draft => {
            if (typeof value === 'undefined') {
              draft = omit(prevState, [key as string]);
            } else {
              set(draft, key as string, value);
            }
          })
        );

        return true;
      }

      // Scenario 3, its an object
      const auxState = {};
      Object.keys(params).forEach(key => {
        set(auxState, key, (params as Record<string, unknown>)[key]);
      });

      setState(omit(auxState, cache.attributesBinded));

      return true;
    },
    [cache, previewMode]
  );

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

  const setStatePostCallback: InteractionPostCallback = useCallback((params, callbackResult) => {
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
  }, []);

  const internalPropsParsed = useMemo<InternalPropsSTG2>(() => {
    const internalPropsAux = getProps(element, internalProps, style, plitziCustomComponent, dataSource);
    const { attributes, definition } = internalPropsAux;

    return {
      ...internalPropsAux,
      attributes: { ...attributes, ...omit(state, ['visibility', 'styleSelectors']) },
      definition: { ...definition, styleSelectors: { ...definition.styleSelectors, ...(state.styleSelectors ?? {}) } },
      elementState: { ...definition.initialState, ...state },
      setElementState,
      interactionsBasicCallbacks: getInteractions(attributes, definition, setStateCallback, setStatePostCallback)
    };
  }, [
    element,
    style,
    internalProps,
    plitziCustomComponent,
    dataSource,
    state,
    setElementState,
    setStateCallback,
    setStatePostCallback
  ]);

  return { internalProps: internalPropsParsed, children: undefined, className: '' };
};

export default useInternalProps;
