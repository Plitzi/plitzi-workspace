import type { InteractionBaseCallback } from './InteractionTypes';
import type { PluginManifest, PluginSchema } from './PluginTypes';
import type { Element } from './SchemaTypes';
import type { CSSProperties, ReactNode } from 'react';

export type ElementLayoutType = 'layout' | 'segment' | 'element' | 'reference';

// InternalProps have a lifecycle that needs to follow and in each step will add more props
// PluginManager ->                 -> ComponentPlugin -> withElement -> (preload all hooks) -> RootElement -> render
//               -> PluginRemote -> ^

export type InternalPropsExtension<
  T extends Record<Exclude<string, 'id' | 'rootId'>, unknown> = Record<Exclude<string, 'id' | 'rootId'>, unknown>
> = T;

export type InternalPropsSTG0<T extends InternalPropsExtension = InternalPropsExtension> = {
  id: string;
  rootId?: string;
  plitziJsxSkipHOC?: boolean;
} & T;

export type InternalPropsSTG1<T extends InternalPropsExtension = InternalPropsExtension> = InternalPropsSTG0<T> & {
  className?: string;
  plitziElementLayout?: {
    bodyChildren: ReactNode;
    containerId: string;
    referenceId: string;
    rootId: string;
    type: ElementLayoutType;
  };
};

export type InternalPropsSTG2<T extends InternalPropsExtension = InternalPropsExtension> = InternalPropsSTG1<T> & {
  definition: Element['definition'];
  attributes: Element['attributes'];
  elementState: Record<string, unknown>;
  interactionsBasicCallbacks?: Record<string, InteractionBaseCallback>;
  setElementState: <T2 extends Record<string, unknown> = Record<string, unknown>>(
    params?: ((state: T2) => T2) | { key: string; value?: string | boolean | number } | T2
  ) => void;
  interactions?: Element['definition']['interactions'];
  style?: CSSProperties;
  styleSelectors: Element['definition']['styleSelectors'];
};

export type ComponentDefinition = Pick<PluginSchema, 'attributes' | 'builder' | 'definition' | 'defaultStyle'> & {
  assets: { type: 'style' | 'script'; url: string }[];
  manifest: PluginManifest;
  market: Omit<PluginManifest, 'name'> & { category: string };
  settings: { [key: string]: unknown };
};
