// Packages
import React, { useCallback, useMemo, useRef, useState } from 'react';
import omit from 'lodash/omit.js';
import get from 'lodash/get.js';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import defaultElements from '../index.js';
import ComponentContext from './ComponentContext.js';
import { processLocalCustomPlugins, processLocalPlugins, getPlugins } from './ComponentHelper.js';

/**
 * @param {{
 *   remoteComponents: object;
 *   localComponents: object;
 *   localCustomComponents: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const ComponentProvider = props => {
  const {
    remoteComponents: remoteComponentsProp = emptyObject,
    localComponents = emptyObject,
    localCustomComponents = emptyObject,
    children
  } = props;

  const [localComponentsParsed] = useState(() => ({
    ...processLocalPlugins(defaultElements),
    ...processLocalPlugins(localComponents),
    ...processLocalCustomPlugins(localCustomComponents)
  }));
  const [remoteComponents, setRemoteComponents] = useState(remoteComponentsProp);
  const totalComponents = useRef({ ...remoteComponents, ...localComponentsParsed });

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
      totalComponents.current = { ...state, ...componentsToAppend, ...localComponentsParsed };

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
      totalComponents.current = { ...omit(state, componentsToRemove), ...localComponentsParsed };

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

  return <ComponentContext value={componentsContextValue}>{children}</ComponentContext>;
};

export default ComponentProvider;
