// Packages
import React, { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import omit from 'lodash/omit';
import get from 'lodash/get';

// Relatives
import { defaultElements } from '../../SdkComponents';
import ComponentContext from './ComponentContext';
import { processLocalCustomPlugins, processLocalPlugins, getPlugins } from './ComponentHelper';
import { emptyObject } from '../../helpers/utils';

const ComponentProvider = props => {
  const { remoteComponents: remoteComponentsProp = emptyObject, localCustomComponents = emptyObject, children } = props;

  const [localComponents] = useState(() => ({
    ...processLocalPlugins(defaultElements),
    ...processLocalCustomPlugins(localCustomComponents)
  }));
  const [remoteComponents, setRemoteComponents] = useState(remoteComponentsProp);
  const totalComponents = useRef({ ...remoteComponents, ...localComponents });

  const getComponent = useCallback((componentTypes = [], withPlugins = false) => {
    if (typeof componentTypes === 'string' && !withPlugins) {
      return totalComponents.current[componentTypes];
    }

    if (typeof componentTypes === 'string' && withPlugins) {
      const component = totalComponents.current[componentTypes];
      if (!component) {
        return {};
      }

      return { [componentTypes]: component, ...omit(getPlugins(component), [componentTypes]) };
    }

    let componentsToReturn = {};
    componentTypes.forEach(componentType => {
      const component = totalComponents.current[componentType];
      if (!component) {
        return;
      }

      if (withPlugins) {
        componentsToReturn = { ...componentsToReturn, ...omit(getPlugins(component), [componentType]) };
      } else {
        componentsToReturn[componentType] = component;
      }
    });

    return componentsToReturn;
  }, []);

  const register = useCallback((components = []) => {
    let componentsToAppend = {};
    if (!Array.isArray(components) && components) {
      components = [components];
    }

    components
      .filter(comp => !!comp.type && !totalComponents.current[comp.type])
      .forEach(comp => {
        componentsToAppend = { ...componentsToAppend, [comp.type]: comp, ...getPlugins(comp) };
      });

    if (Object.keys(componentsToAppend).length === 0) {
      return componentsToAppend;
    }

    setRemoteComponents(state => {
      totalComponents.current = { ...state, ...componentsToAppend, ...localComponents };

      return { ...state, ...componentsToAppend };
    });

    return componentsToAppend;
  }, []);

  const unregister = useCallback(componentTypes => {
    if (!componentTypes) {
      return [];
    }

    if (!Array.isArray(componentTypes)) {
      componentTypes = [componentTypes];
    }

    let componentsToRemove = componentTypes;
    componentTypes.forEach(compType => {
      const plugins = getComponent(compType, true);
      if (plugins && Object.keys(plugins).length > 0) {
        componentsToRemove = [...componentsToRemove, ...Object.keys(omit(plugins, compType))];
      }
    });

    setRemoteComponents(state => {
      totalComponents.current = { ...omit(state, componentsToRemove), ...localComponents };

      return omit(state, componentsToRemove);
    });

    return componentsToRemove;
  }, []);

  // Required by builder

  const [componentDefinitions, setComponentDefinitions] = useState(() =>
    Object.keys(totalComponents.current).reduce((acum, elementType) => {
      const component = get(totalComponents.current, elementType, {});
      const content = get(component, 'content', {});

      return {
        ...acum,
        [elementType]: {
          ...content,
          builder: {
            ...content.builder,
            initialItems: component.initialItems
          }
        }
      };
    }, {})
  );

  const registerDefinition = useCallback(plugins => setComponentDefinitions(state => ({ ...state, ...plugins })), []);

  const unregisterDefinition = useCallback(
    pluginType =>
      setComponentDefinitions(state =>
        omit(state, [pluginType, ...get(state, `${pluginType}.builder.pluginChildren`, [])])
      ),
    []
  );

  const getComponentBuilderSettings = useCallback(
    (type, path = '', defaultValue = undefined) => {
      if (!type || !totalComponents.current[type]) {
        return {};
      }

      if (!path) {
        return get(componentDefinitions, `${type}.builder`, {});
      }

      return get(componentDefinitions, `${type}.builder.${path}`, defaultValue);
    },
    [componentDefinitions]
  );

  // End Required by builder

  const componentsContextValue = useMemo(
    () => ({
      getComponentBuilderSettings,
      getComponent,
      register,
      unregister,
      unregisterDefinition,
      registerDefinition,
      components: totalComponents.current,
      componentDefinitions
    }),
    [
      getComponentBuilderSettings,
      totalComponents.current,
      register,
      unregister,
      registerDefinition,
      unregisterDefinition,
      getComponent,
      componentDefinitions
    ]
  );

  return <ComponentContext.Provider value={componentsContextValue}>{children}</ComponentContext.Provider>;
};

ComponentProvider.propTypes = {
  children: PropTypes.node,
  localCustomComponents: PropTypes.object,
  remoteComponents: PropTypes.object
};

export default ComponentProvider;
