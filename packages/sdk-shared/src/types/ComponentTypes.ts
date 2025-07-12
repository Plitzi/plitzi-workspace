import type { ComponentDefinition, InternalPropsSTG1 } from './ElementTypes';
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

export type ComponentContextValue = {
  getComponent: (
    componentTypes: string | string[],
    withPlugins?: boolean
  ) => ComponentPlugin | Record<string, ComponentPlugin>;
  register: (components: ComponentPlugin[] | ComponentPlugin) => Record<string, ComponentPlugin>;
  unregister: (componentTypes: string[] | string) => string[];
  unregisterDefinition: (pluginType: string) => void;
  registerDefinition: (plugins: Record<string, ComponentDefinition>) => void;
  components: Record<string, ComponentPlugin>;
  componentDefinitions: Record<string, ComponentDefinition>;
};
