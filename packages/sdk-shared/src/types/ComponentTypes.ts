/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentDefinition, InternalPropsSTG1 } from './ElementTypes';
import type { Asset } from './PluginTypes';
import type { FC, ReactNode } from 'react';

export type ComponentOrigin = 'local' | 'local-custom' | 'remote';
export type ComponentPluginFC<T = unknown> = FC<
  T & {
    className?: string;
    plitziJsxSkipHOC?: boolean;
    children?: ReactNode;
    extraProps?: Record<string, unknown>;
  }
>;
export type ComponentPlugin<T = unknown> = ComponentPluginFC<T> & {
  content: ComponentDefinition;
  type: string;
  assets: Asset[];
  plugins?: Record<string, ComponentPlugin<T>>;
  origin: ComponentOrigin;
  extraProps?: Record<string, unknown>;
  pluginSettings?: FC<any>;
  version?: string;
  initialItems?: string[];
};

export type ComponentPluginWithHOC<T = unknown> = ComponentPluginFC<T & { internalProps: InternalPropsSTG1 }> & {
  content: ComponentDefinition;
  type: string;
  assets: Asset[];
  plugins?: Record<string, ComponentPluginWithHOC<T>>;
  origin: ComponentOrigin;
  extraProps?: Record<string, unknown>;
  pluginSettings?: FC<any>;
  version?: string;
  initialItems?: string[];
};

export type ComponentContextValue = {
  getComponent: (
    componentTypes: string | string[],
    withPlugins?: boolean
  ) => ComponentPluginWithHOC | Record<string, ComponentPluginWithHOC>;
  register: (components: ComponentPluginWithHOC[] | ComponentPluginWithHOC) => Record<string, ComponentPluginWithHOC>;
  unregister: (componentTypes: string[] | string) => string[];
  unregisterDefinition: (pluginType: string) => void;
  registerDefinition: (plugins: Record<string, ComponentDefinition>) => void;
  components: Record<string, ComponentPluginWithHOC>;
  componentDefinitions: Record<string, ComponentDefinition>;
};
