import get from 'lodash/get';
import omit from 'lodash/omit';
import { useCallback, useMemo, useRef, useState } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import { defaultElements } from '..';
import { processLocalCustomPlugins, processLocalPlugins, getPlugins } from './ComponentHelper';

import type { ComponentDefinition, ComponentPlugin, ComponentPlugins } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type ComponentProviderProps = {
  localComponents: ComponentPlugins;
  localCustomComponents: ComponentPlugins;
  children?: ReactNode;
};

const ComponentProvider = ({
  localComponents = emptyObject,
  localCustomComponents = emptyObject,
  children
}: ComponentProviderProps) => {
  const localComponentsParsed = useMemo<ComponentPlugins>(
    () => ({
      ...processLocalPlugins(defaultElements as unknown as ComponentPlugins),
      ...processLocalPlugins(localComponents),
      ...processLocalCustomPlugins(localCustomComponents)
    }),
    [localComponents, localCustomComponents]
  );
  const [remoteComponents, setRemoteComponents] = useState<ComponentPlugins>({});
  const totalComponents = useRef({ ...remoteComponents, ...localComponentsParsed });

  const getComponent = useCallback((componentTypes: string | string[] = [], withPlugins = false) => {
    if (typeof componentTypes === 'string' && !withPlugins) {
      return totalComponents.current[componentTypes];
    }

    if (typeof componentTypes === 'string' && withPlugins) {
      const component = totalComponents.current[componentTypes] as ComponentPlugin | undefined;
      if (!component) {
        return {};
      }

      return { [componentTypes]: component, ...omit(getPlugins(component), [componentTypes]) };
    }

    let componentsToReturn: ComponentPlugins = {};
    (componentTypes as string[]).forEach(componentType => {
      const component = totalComponents.current[componentType] as ComponentPlugin | undefined;
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

  const register = useCallback(
    (components: ComponentPlugin[] | ComponentPlugin = []) => {
      let componentsToAppend: ComponentPlugins = {};
      if (!Array.isArray(components)) {
        components = [components];
      }

      components.forEach(comp => {
        if (comp.type && !(totalComponents.current[comp.type] as ComponentPlugin | undefined)) {
          componentsToAppend = { ...componentsToAppend, [comp.type]: comp, ...getPlugins(comp) };
        }
      });

      if (Object.keys(componentsToAppend).length === 0) {
        return componentsToAppend;
      }

      setRemoteComponents(state => {
        totalComponents.current = { ...state, ...componentsToAppend, ...localComponentsParsed };

        return { ...state, ...componentsToAppend };
      });

      return componentsToAppend;
    },
    [localComponentsParsed]
  );

  const unregister = useCallback(
    (componentTypes: string[] | string) => {
      if (!componentTypes) {
        return [];
      }

      if (!Array.isArray(componentTypes)) {
        componentTypes = [componentTypes];
      }

      let componentsToRemove = componentTypes;
      componentTypes.forEach(compType => {
        const plugins = getComponent([compType], true);
        if (Object.keys(plugins).length > 0) {
          componentsToRemove = [...componentsToRemove, ...Object.keys(omit(plugins, compType))];
        }
      });

      setRemoteComponents(state => {
        totalComponents.current = { ...omit(state, componentsToRemove), ...localComponentsParsed };

        return omit(state, componentsToRemove);
      });

      return componentsToRemove;
    },
    [getComponent, localComponentsParsed]
  );

  // Required by builder

  const [componentDefinitions, setComponentDefinitions] = useState<Record<string, ComponentDefinition>>(() =>
    Object.keys(totalComponents.current).reduce((acum, elementType) => {
      const component = get(totalComponents.current, elementType) as ComponentPlugin | undefined;
      if (!component) {
        return acum;
      }

      const content = get(component, 'content', {}) as ComponentDefinition;

      return {
        ...acum,
        [elementType]: { ...content, builder: { ...content.builder, initialItems: component.initialItems } }
      };
    }, {})
  );

  const registerDefinition = useCallback(
    (plugins: Record<string, ComponentDefinition>) => setComponentDefinitions(state => ({ ...state, ...plugins })),
    []
  );

  const unregisterDefinition = useCallback(
    (pluginType: string) =>
      setComponentDefinitions(state =>
        omit(state, [pluginType, ...(get(state, `${pluginType}.builder.pluginChildren`, []) as string[])])
      ),
    []
  );

  const getComponentBuilderSettings = useCallback(
    (type: string, path = '', defaultValue?: boolean) => {
      if (!type || !(totalComponents.current[type] as ComponentPlugin | undefined)) {
        return undefined;
      }

      if (!path) {
        return get(componentDefinitions, `${type}.builder`, {}) as ComponentPlugin['content']['builder'];
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
