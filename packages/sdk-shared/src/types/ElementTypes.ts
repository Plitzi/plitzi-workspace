import type { Asset, PluginManifest, PluginSchema } from './PluginTypes';
import type { Element } from './SchemaTypes';

export type ElementLayoutType = 'layout' | 'segment' | 'element' | 'reference';

/**
 * Which shell an element is rendered inside, and which of its containers is the slot.
 *
 * Every element of the shell carries it, so it holds nothing that changes with the page: the body itself reaches the
 * slot through `LayoutBody` in `@plitzi/sdk-elements`.
 */
export type ElementLayout = {
  containerId: string;
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
  assetsSettings: Omit<Asset, 'isMain'>[];
  manifest: PluginManifest;
  market: Omit<PluginManifest, 'name'> & { category: string };
  settings: { [key: string]: string | number | boolean };
  type: string;
  subPlugins: string[];
  resource: string;
  isMain?: boolean;
} & PluginManifest['runtime'];
