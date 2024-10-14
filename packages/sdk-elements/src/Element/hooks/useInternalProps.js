// Packages
import { useMemo, useState, useCallback, useRef } from 'react';
import get from 'lodash/get.js';
import omit from 'lodash/omit.js';

// Monorepo
import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/twigWrapper';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Helpers

const getCache = definition => {
  const bindingsState = get(definition, 'bindings.initialState', []);
  let stateBinded = [];
  if (Array.isArray(bindingsState)) {
    stateBinded = bindingsState.map(binding => get(binding, 'toPath', ''));
  }

  const bindingsAttributes = get(definition, 'bindings.attributes', []);
  let attributesBinded = [];
  if (Array.isArray(bindingsAttributes)) {
    attributesBinded = bindingsAttributes.map(binding => get(binding, 'toPath', ''));
  }

  return { stateBinded, attributesBinded };
};

// Methods

const getProps = (element, internalProps = {}, plitziCustomComponent = false, dataSource = {}) => {
  let { attributes, definition } = element;
  const { attributes: attributesProp, rootId, plitziElementLayout } = internalProps;
  if (plitziCustomComponent && attributesProp) {
    attributes = omit({ ...attributes, ...attributesProp }, ['settings']);
  }

  // Data Sources
  let style = {};
  if (dataSource && Object.keys(dataSource).length > 0) {
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
      styleSelectors: { ...definition?.styleSelectors, ...definition?.initialState?.styleSelectors }
    },
    interactions: get(definition, 'interactions', {}),
    styleSelectors: get(definition, 'styleSelectors', {}),
    style
  };
};

const getInteraction = (attributes, definition, callback, postCallback) => ({
  setState: {
    title: `Update ${definition?.label}`,
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
            return Object.keys(definition.initialState).map(attributeState => ({
              value: attributeState,
              label: attributeState
            }));
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

const useInternalProps = props => {
  const {
    element,
    internalProps = emptyObject,
    plitziCustomComponent = false,
    dataSource = emptyObject,
    previewMode = false
  } = props;
  const prevStateRef = useRef({});
  const [state, setState] = useState({});
  const cache = useMemo(() => getCache(element?.definition), [element?.definition]);

  const setElementState = useCallback(
    params => {
      if (!previewMode || !params || (typeof params !== 'object' && typeof params !== 'function')) {
        return false;
      }

      if (typeof params === 'function') {
        setState(prevState => ({ ...prevState, ...omit(params(prevState), cache.attributesBinded) }));

        return true;
      }

      let auxState = params;
      if (params?.key && params?.value !== undefined) {
        const { key } = params;
        let { value } = params;
        if (value === 'true' || value === 'false' || value === 'yes' || value === 'no') {
          value = value === 'true' || value === 'yes';
        }

        setState(prevState => {
          if (typeof value === 'boolean' || value || value === '' || value === 0) {
            auxState = { ...prevState, [key]: value };
          } else {
            auxState = omit(prevState, [key]);
          }

          return auxState;
        });

        return true;
      }

      setState(omit(params, cache.attributesBinded));

      return true;
    },
    [cache, state, previewMode]
  );

  const setStateCallback = useCallback(params => {
    const prevState = prevStateRef.current;
    let auxState = params;
    if (!params || !params.key || !params.value) {
      return { prevState, nextState: prevState };
    }

    const { key } = params;
    let { value } = params;
    if (value === 'true' || value === 'false' || value === 'yes' || value === 'no') {
      value = value === 'true' || value === 'yes';
    }

    if (typeof value === 'boolean' || value || value === '' || value === 0) {
      auxState = { ...prevState, [key]: value };
    } else {
      auxState = omit(prevState, [key]);
    }

    if (setElementState(auxState)) {
      prevStateRef.current = auxState;

      return { prevState, nextState: auxState };
    }

    return { prevState, nextState: prevState };
  }, []);

  const setStatePostCallback = useCallback((params, callbackResult) => {
    const { revertOnFinish } = params;
    if (!callbackResult || !callbackResult?.prevState) {
      return;
    }

    const { prevState } = callbackResult;
    if (!revertOnFinish) {
      return;
    }

    prevStateRef.current = prevState;
    setState(prevState);
  }, []);

  const internalPropsParsed = useMemo(() => {
    const internalPropsAux = getProps(element, internalProps, plitziCustomComponent, dataSource);
    const { attributes, definition } = internalPropsAux;

    return {
      ...internalPropsAux,
      attributes: { ...attributes, ...omit(state, ['visibility', 'styleSelectors']) },
      definition: { ...definition, styleSelectors: { ...definition?.styleSelectors, ...state?.styleSelectors } },
      elementState: { ...definition.initialState, ...state },
      setElementState,
      interactionsBasicCallbacks: getInteraction(attributes, definition, setStateCallback, setStatePostCallback)
    };
  }, [
    element?.definition,
    element?.attributes,
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
