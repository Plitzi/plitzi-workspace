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
  InteractionBaseCallback,
  InteractionCallback,
  InteractionCallbackParamValues,
  InteractionPostCallback,
  InternalPropsSTG1,
  InternalPropsSTG2
} from '@plitzi/sdk-shared';

// Helpers

const getCache = (bindings?: Partial<Element['definition']['bindings']>) => {
  if (!bindings) {
    return { stateBinded: [], attributesBinded: [] };
  }

  return {
    stateBinded: bindings.initialState?.map(binding => get(binding, 'toPath', '')) ?? [],
    attributesBinded: bindings.attributes?.map(binding => get(binding, 'toPath', '')) ?? []
  };
};

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
  const cache = useMemo(() => getCache(element.definition.bindings), [element.definition.bindings]);

  const setElementState = useCallback(
    <T extends Record<string, unknown> = Record<string, unknown>>(value?: T | ((prev: T) => T)) => {
      if (!previewMode) {
        return false;
      }

      setState(prev => {
        if (!value) {
          return {};
        }

        let next = typeof value === 'function' ? value(prev as T) : value;
        if (cache.attributesBinded.length) {
          next = omit(next, cache.attributesBinded) as T;
        }

        return next;
      });

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
