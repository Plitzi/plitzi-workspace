import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useRef, useState } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import { defaultElements } from '..';
import { processLocalCustomPlugins, processLocalPlugins, getPlugins } from './ComponentHelper';

import type { ComponentDefinition, ComponentPluginWithHOC } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type ComponentProviderProps = {
  localComponents?: Record<string, ComponentPluginWithHOC>;
  localCustomComponents?: Record<string, ComponentPluginWithHOC>;
  children?: ReactNode;
};

const ComponentProvider = ({ localComponents, localCustomComponents, children }: ComponentProviderProps) => {
  const localComponentsParsed = useMemo<Record<string, ComponentPluginWithHOC>>(
    () => ({
      ...processLocalPlugins(defaultElements as unknown as Record<string, ComponentPluginWithHOC>),
      ...processLocalPlugins(localComponents),
      ...processLocalCustomPlugins(localCustomComponents)
    }),
    [localComponents, localCustomComponents]
  );
  const [remoteComponents, setRemoteComponents] = useState<Record<string, ComponentPluginWithHOC>>({});
  const components = useRef({ ...remoteComponents, ...localComponentsParsed });

  const getComponent = useCallback((componentTypes: string | string[] = [], withPlugins = false) => {
    if (typeof componentTypes === 'string' && !withPlugins) {
      return components.current[componentTypes];
    }

    if (typeof componentTypes === 'string' && withPlugins) {
      const component = components.current[componentTypes] as ComponentPluginWithHOC | undefined;
      if (!component) {
        return {};
      }

      return { [componentTypes]: component, ...omit(getPlugins(component), [componentTypes]) };
    }

    let componentsToReturn: Record<string, ComponentPluginWithHOC> = {};
    (componentTypes as string[]).forEach(componentType => {
      const component = components.current[componentType] as ComponentPluginWithHOC | undefined;
      if (!component) {
        return;
      }

      if (withPlugins) {
        componentsToReturn = {
          ...componentsToReturn,
          ...omit(getPlugins(component), [componentType])
        };
      } else {
        componentsToReturn[componentType] = component;
      }
    });

    return componentsToReturn;
  }, []);

  const register = useCallback(
    (newComponents: ComponentPluginWithHOC[] | ComponentPluginWithHOC = []) => {
      let componentsToAppend: Record<string, ComponentPluginWithHOC> = {};
      if (!Array.isArray(newComponents)) {
        newComponents = [newComponents];
      }

      newComponents.forEach(comp => {
        if (comp.type && !(components.current[comp.type] as ComponentPluginWithHOC | undefined)) {
          componentsToAppend = { ...componentsToAppend, [comp.type]: comp, ...getPlugins(comp) };
        }
      });

      if (Object.keys(componentsToAppend).length === 0) {
        return componentsToAppend;
      }

      setRemoteComponents(state => {
        components.current = { ...state, ...componentsToAppend, ...localComponentsParsed };

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
          componentsToRemove = [
            ...componentsToRemove,
            ...Object.keys(omit(plugins as Record<string, ComponentPluginWithHOC>, compType))
          ];
        }
      });

      setRemoteComponents(state => {
        components.current = {
          ...(omit(state, componentsToRemove) as Record<string, ComponentPluginWithHOC>),
          ...localComponentsParsed
        };

        return omit(state, componentsToRemove) as Record<string, ComponentPluginWithHOC>;
      });

      return componentsToRemove;
    },
    [getComponent, localComponentsParsed]
  );

  // Required by builder

  const [componentDefinitions, setComponentDefinitions] = useState<Record<string, ComponentDefinition>>(() =>
    Object.keys(components.current).reduce((acum, elementType) => {
      const component = get(components.current, elementType, undefined);
      if (!component || !(component.content as ComponentDefinition | undefined)) {
        return acum;
      }

      return { ...acum, [elementType]: { ...component.content, initialItems: component.initialItems } };
    }, {})
  );

  const registerDefinition = useCallback(
    (plugins: Record<string, ComponentDefinition>) => setComponentDefinitions(state => ({ ...state, ...plugins })),
    []
  );

  const unregisterDefinition = useCallback(
    (pluginType: string) =>
      setComponentDefinitions(
        state =>
          omit(state, [pluginType, ...get(state, `${pluginType}.builder.pluginChildren`, [] as string[])]) as Record<
            string,
            ComponentDefinition
          >
      ),
    []
  );

  // End Required by builder

  const componentsContextValue = useMemo(
    () => ({
      getComponent,
      register,
      unregister,
      unregisterDefinition,
      registerDefinition,
      components,
      componentDefinitions
    }),
    [register, unregister, registerDefinition, unregisterDefinition, getComponent, componentDefinitions]
  );

  return <ComponentContext value={componentsContextValue}>{children}</ComponentContext>;
};

export default ComponentProvider;
