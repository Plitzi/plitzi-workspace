/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentDefinition, InternalPropsSTG1 } from './ElementTypes';
import type { Asset } from './PluginTypes';
import type { FC, ReactNode, RefObject } from 'react';

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
  assetsSettings: Omit<Asset, 'isMain'>[];
  plugins?: Record<string, ComponentPlugin<T>>;
  origin: ComponentOrigin;
  extraProps?: Record<string, unknown>;
  pluginSettings?: FC<any>;
  version?: string;
  initialItems?: string[];
};

/**
 * What a plugin says about itself apart from its code — its definition, its sub-plugins' — as data a page can carry.
 *
 * A page is sent with the plugins it draws and only the declarations of the rest: the space knows every type it has
 * (an element's defaults, a sub-plugin's name) from the start, and a plugin's code is fetched when a page that draws
 * it is opened.
 */
export type PluginDeclaration = {
  content?: ComponentDefinition;
  version?: string;
  initialItems?: string[];
  plugins?: Record<string, PluginDeclaration>;
};

export type ComponentPluginWithHOC<T = unknown> = ComponentPluginFC<T & { internalProps: InternalPropsSTG1 }> & {
  content: ComponentDefinition;
  type: string;
  assets: Asset[];
  assetsSettings: Omit<Asset, 'isMain'>[];
  plugins?: Record<string, ComponentPluginWithHOC<T>>;
  origin: ComponentOrigin;
  extraProps?: Record<string, unknown>;
  pluginSettings?: FC<any>;
  version?: string;
  initialItems?: string[];
};

export type ComponentContextValue = {
  components: RefObject<Record<string, ComponentPluginWithHOC>>;
  componentDefinitions: RefObject<Record<string, ComponentDefinition>>;
  getComponent: (
    componentTypes: string | string[],
    withPlugins?: boolean
  ) => ComponentPluginWithHOC | Record<string, ComponentPluginWithHOC>;
  register: (components: ComponentPluginWithHOC[] | ComponentPluginWithHOC) => Record<string, ComponentPluginWithHOC>;
  unregister: (componentTypes: string[] | string) => string[];
  unregisterDefinition: (pluginType: string) => void;
  registerDefinition: (plugins: Record<string, ComponentDefinition>) => void;
};
