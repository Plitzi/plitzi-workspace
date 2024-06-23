// Packages
import React, { isValidElement } from 'react';
import get from 'lodash/get';
import omit from 'lodash/omit';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Monorepo
import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/twigWrapper';

// Alias
import PluginManager from '../../../PluginManager';
import { PARTIAL_SCHEMA_TYPE_SEGMENT } from '../../../ElementConstants';

class ElementController {
  setReRender = noop;

  id = '';

  dataSourceContext = {};

  interactionsBasicCallbacks = {};

  baseInternalProps = {};

  internalProps = {};

  params = {};

  state = {};

  cache = {
    layoutKeyIdentifier: 0,
    attributesBinded: [],
    stateBinded: []
  };

  constructor(
    setReRender,
    id,
    internalProps,
    schema,
    { isCustomComponent = false, previewMode = true, baseElementId = '' }
  ) {
    this.setReRender = setReRender;
    this.id = id;
    this.params = { isCustomComponent, previewMode, baseElementId };

    this.baseInternalProps = this.parseBase(internalProps, schema);
    this.initInteractions();
    this.initState(this.baseInternalProps);
    this.refreshLayoutKeyIdentifier();
  }

  // Init

  initInteractions = () => {
    const { attributes, definition } = this.baseInternalProps;
    const label = get(definition, 'label', this.id);

    this.interactionsBasicCallbacks = {
      setState: {
        title: `Update ${label}`,
        callback: this.handleState,
        postCallback: this.handlePostState,
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
    };
  };

  initState = internalProps => {
    const { definition } = internalProps;
    const { attributesBinded } = this.cache;
    this.state = omit(get(definition, 'initialState', {}), attributesBinded);
  };

  // Parsers

  parseBase = (internalProps, schema) => {
    const { attributes, definition } = get(schema, `flat.${this.id}`, { attributes: {}, definition: {} });
    const { attributes: attributesProp, rootId, plitziElementLayout } = internalProps;
    let attributesFinal = attributes;
    if (this.params.isCustomComponent && attributesProp) {
      attributesFinal = { ...attributesFinal, ...attributesProp };
      delete attributesFinal.settings;
    }

    // Set Binding Cache

    const bindingsState = get(definition, 'bindings.initialState', []);
    if (Array.isArray(bindingsState)) {
      this.cache.stateBinded = bindingsState.map(binding => get(binding, 'toPath', ''));
    }

    const bindingsAttributes = get(definition, 'bindings.attributes', []);
    if (Array.isArray(bindingsAttributes)) {
      this.cache.attributesBinded = bindingsAttributes.map(binding => get(binding, 'toPath', ''));
    }

    // Custom Attributes

    const customAttributes = omit(internalProps, ['id', 'rootId', 'attributes', 'definition', 'plitziElementLayout']);

    return {
      ...internalProps,
      rootId: get(plitziElementLayout, 'rootId', rootId),
      attributes: { ...attributesFinal, ...customAttributes },
      definition,
      interactions: get(definition, 'interactions', {}),
      styleSelectors: get(definition, 'styleSelectors', {})
    };
  };

  parseVariables = variables => {
    if (!variables || typeof variables !== 'object' || Object.keys(variables).length === 0) {
      return this.internalProps;
    }

    const { attributes } = this.internalProps;
    const attributesWithVariables = Object.keys(attributes).reduce((acum, key) => {
      if (typeof attributes[key] === 'string' && hasTokens(attributes[key])) {
        return { ...acum, [key]: processTwig(attributes[key], variables) };
      }

      return { ...acum, [key]: attributes[key] };
    }, {});

    this.internalProps = { ...this.internalProps, attributes: { ...attributes, ...attributesWithVariables } };

    return this.internalProps;
  };

  parse = dataSourceContext => {
    const { attributes: baseAttributes, definition: baseDefinition } = this.baseInternalProps;
    const { attributesBinded, stateBinded } = this.cache;

    // Data Sources
    const bindingData = getBindingsDetails(dataSourceContext, baseAttributes, baseDefinition);
    const { attributes, definition, style } = bindingData;

    // State
    this.state = omit(this.state, [...attributesBinded, ...stateBinded]); // clean up overrieded attributes
    Object.keys(this.state).forEach(key => {
      const item = this.state[key];
      if (item && typeof item === 'object' && Object.keys(item).length === 0) {
        delete this.state[key];
      }
    });

    this.state = { ...definition.initialState, ...this.state };
    this.internalProps = {
      ...this.baseInternalProps,
      attributes: { ...attributes, ...omit(this.state, ['visibility', 'styleSelectors']) },
      definition: { ...definition, styleSelectors: { ...definition?.styleSelectors, ...this.state?.styleSelectors } },
      interactionsBasicCallbacks: this.interactionsBasicCallbacks,
      elementState: this.state,
      setElementState: this.handleState,
      style
    };

    return this.parseVariables(dataSourceContext?.variables);
  };

  // State

  setState = (prevState, nextState) => {
    if (typeof prevState !== 'object' || typeof nextState !== 'object') {
      return prevState;
    }

    if (prevState !== nextState) {
      const { attributesBinded } = this.cache;
      nextState = omit(nextState, attributesBinded);
      this.state = nextState;
      this.setReRender(Date.now());

      return nextState;
    }

    return prevState;
  };

  handleState = params => {
    const prevState = this.state;
    if (!this.params.previewMode || (typeof params !== 'object' && typeof params !== 'function')) {
      return { prevState, nextState: prevState };
    }

    if (typeof params === 'function') {
      const newState = params(prevState);
      if (typeof newState !== 'object') {
        return { prevState, nextState: prevState };
      }

      return { prevState, nextState: this.setState(prevState, newState) };
    }

    let auxState = params;
    if (params?.key) {
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

      const nextState = this.setState(prevState, auxState);

      return { prevState, nextState };
    }

    const nextState = this.setState(prevState, params);

    return { prevState, nextState };
  };

  handlePostState = (params, callbackResult) => {
    const { revertOnFinish } = params;
    if (!callbackResult || !callbackResult?.prevState) {
      return;
    }

    const { prevState } = callbackResult;
    if (!revertOnFinish) {
      return;
    }

    this.state = prevState;
    this.setReRender(Date.now());
  };

  // Items

  parseItems = (schema, children, SchemaContext, prevSchema, newSchema) => {
    const { id, definition, plitziElementLayout } = this.internalProps;
    const { previewMode } = this.params;
    const { layoutKeyIdentifier } = this.cache;
    const { items } = definition;

    if (!plitziElementLayout && !children && (!items || items.length === 0)) {
      return undefined;
    }

    // Process items
    const flat = get(schema, 'flat', {});
    const itemsParsed = (items ?? [])
      .filter(itemId => !!flat[itemId])
      .map(itemId => {
        const { rootId, type } = get(flat, `${itemId}.definition`, {});
        const finalRootId = get(plitziElementLayout, 'rootId', rootId);

        return (
          <PluginManager
            key={!previewMode && plitziElementLayout ? `${itemId}_${layoutKeyIdentifier}` : itemId}
            id={itemId}
            rootId={finalRootId}
            plitziElementLayout={plitziElementLayout}
            type={type}
          />
        );
      });

    // Process Layout
    if (plitziElementLayout) {
      const { containerId, bodyChildren } = plitziElementLayout;
      if (containerId === id) {
        itemsParsed.push(bodyChildren);
      }
    }

    // Process Children
    if (Array.isArray(children)) {
      itemsParsed.push(...children);
    } else if (children && isValidElement(children)) {
      itemsParsed.push(children);
    }

    if (
      plitziElementLayout &&
      plitziElementLayout.type === PARTIAL_SCHEMA_TYPE_SEGMENT &&
      plitziElementLayout?.containerId === id &&
      prevSchema
    ) {
      return (
        <SchemaContext value={newSchema}>{itemsParsed?.length === 1 ? itemsParsed[0] : itemsParsed}</SchemaContext>
      );
    }

    // Output
    if (itemsParsed.length === 1) {
      return itemsParsed[0];
    }

    return itemsParsed;
  };

  // Others

  refreshLayoutKeyIdentifier = () => {
    this.cache.layoutKeyIdentifier = Math.round(Math.random() * 100);
  };

  getClassName = className => {
    const { id, plitziElementLayout, definition } = this.internalProps;
    const { items } = definition;
    const { previewMode, baseElementId } = this.params;

    return classNames(className, {
      'plitzi-component--hidden': this.state?.visibility === false || this.state?.visibility === 'false',
      'plitzi-component': !previewMode && !plitziElementLayout,
      'plitzi-component--layout': !previewMode && plitziElementLayout,
      with__container: !previewMode && !!items,
      'container--empty': !previewMode && !!items && (!items || items.length === 0),
      'container--base-element': !previewMode && !!items && baseElementId === id
    });
  };
}

export default ElementController;
