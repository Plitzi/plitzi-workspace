import { createContext } from 'react';

import type { ComponentDefinition, PluginBuilder, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactElement, ReactNode } from 'react';

export type ComponentOrigin = 'local' | 'local-custom' | 'remote';
export type ComponentPlugin<T = unknown> = FC<
  T & {
    internalProps: InternalPropsSTG1;
    className?: string;
    plitziCustomComponent?: boolean;
    plitziJsxSkipHOC?: boolean;
    children?: ReactNode;
  }
> & {
  content: ComponentDefinition;
  type: string;
  assets: unknown;
  plugins?: Record<string, ComponentPlugin<T>>;
  origin: ComponentOrigin;
  pluginSettings?: ReactElement;
  version?: string;
  initialItems?: string[];
};
export type ComponentPlugins<T = unknown> = Record<string, ComponentPlugin<T>>;

export type ComponentContextValue = {
  getComponentBuilderSettings: (
    type: string,
    path?: string,
    defaultValue?: boolean
  ) => boolean | ComponentDefinition | PluginBuilder | undefined;
  getComponent: (componentTypes: string[], withPlugins?: boolean) => ComponentPlugin | ComponentPlugins;
  register: (components: ComponentPlugin[] | ComponentPlugin) => ComponentPlugins;
  unregister: (componentTypes: string[] | string) => string[];
  unregisterDefinition: (pluginType: string) => void;
  registerDefinition: (plugins: Record<string, ComponentDefinition>) => void;
  components: ComponentPlugins;
  componentDefinitions: Record<string, ComponentDefinition>;
};

const componentContextDefaultValue = {};

const ComponentContext = createContext<ComponentContextValue>(componentContextDefaultValue as ComponentContextValue);

export default ComponentContext;
