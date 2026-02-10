import type { Asset, PluginManifest, PluginSchema } from './PluginTypes';
import type { Element } from './SchemaTypes';
import type { ReactNode } from 'react';

export type ElementLayoutType = 'layout' | 'segment' | 'element' | 'reference';

export type ElementLayout = {
  bodyChildren: ReactNode;
  containerId: string;
  referenceId: string;
  rootId: string;
  type: ElementLayoutType;
};

// InternalProps have a lifecycle that needs to follow and in each step will add more props
// PluginManager ->                 -> ComponentPlugin -> withElement -> (preload all hooks) -> RootElement -> render
//               -> PluginRemote -> ^

export type InternalPropsExtension<
  T extends Record<Exclude<string, 'id' | 'rootId'>, unknown> = Record<Exclude<string, 'id' | 'rootId'>, unknown>
> = T;

export type InternalPropsSTG0<T extends InternalPropsExtension = InternalPropsExtension> = {
  id: string;
  rootId?: string;
} & T;

export type InternalPropsSTG1<T extends InternalPropsExtension = InternalPropsExtension> = InternalPropsSTG0<T> & {
  plitziElementLayout?: ElementLayout;
  // Related to inject properties, for example Custom Element
  attributes?: Element['attributes'];
};

export type ComponentDefinition = Pick<
  PluginSchema,
  'attributes' | 'builder' | 'definition' | 'defaultStyle' | 'initialItems'
> & {
  assets: Asset[];
  manifest: PluginManifest;
  market: Omit<PluginManifest, 'name'> & { category: string };
  settings: { [key: string]: string | number | boolean };
  type: string;
  subPlugins: string[];
  resource: string;
  isMain?: boolean;
} & PluginManifest['runtime'];
