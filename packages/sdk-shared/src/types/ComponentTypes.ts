import type { ComponentDefinition, InternalPropsSTG1 } from './ElementTypes';
import type { PluginBuilder } from './PluginTypes';
import type { FC, ReactNode } from 'react';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pluginSettings?: FC<any>;
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
  getComponent: (componentTypes: string | string[], withPlugins?: boolean) => ComponentPlugin | ComponentPlugins;
  register: (components: ComponentPlugin[] | ComponentPlugin) => ComponentPlugins;
  unregister: (componentTypes: string[] | string) => string[];
  unregisterDefinition: (pluginType: string) => void;
  registerDefinition: (plugins: Record<string, ComponentDefinition>) => void;
  components: ComponentPlugins;
  componentDefinitions: Record<string, ComponentDefinition>;
};
