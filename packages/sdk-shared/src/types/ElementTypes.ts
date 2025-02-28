import type { PluginManifest, PluginSchema } from './PluginTypes';
import type { Element, InteractionBaseCallback } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type ElementLayoutType = 'layout' | 'segment' | 'element' | 'reference';

// InternalProps have a lifecycle that needs to follow and in each step will add more props
// PluginManager ->                 -> ComponentPlugin -> withElement -> (preload all hooks) -> RootElement -> render
//               -> PluginRemote -> ^

export type InternalPropsExtension = Record<Exclude<string, 'id' | 'rootId'>, unknown>;

export type InternalPropsSTG0<T extends InternalPropsExtension = InternalPropsExtension> = {
  id: string;
  rootId?: string;
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
  interactions?: Element['definition']['interactions'];
  interactionsBasicCallbacks?: Record<string, InteractionBaseCallback>;
  setElementState: (state: Record<string, unknown>) => void;
};

export type InternalPropSTG3<T extends InternalPropsExtension = InternalPropsExtension> = InternalPropsSTG2<T> & {};

export type ComponentDefinition = Pick<PluginSchema, 'attributes' | 'builder' | 'definition' | 'defaultStyle'> & {
  assets: { type: 'style' | 'script'; url: string }[];
  manifest: PluginManifest;
  market: Omit<PluginManifest, 'name'> & { category: string };
  settings: { [key: string]: unknown };
};

// deprecated

export type BaseInternalProps = { id: string; rootId?: string; className?: string };

export type InternalProps<T extends Record<string, unknown> = Record<string, unknown>> = BaseInternalProps & {
  definition: Element['definition'];
  attributes: Element['attributes'];
  style?: CSSProperties;
  interactions?: Element['definition']['interactions'];
  interactionsBasicCallbacks?: Record<string, InteractionBaseCallback>;
  elementState?: Record<string, string | boolean | number>;
  plitziElementLayout?: {
    bodyChildren: ReactNode;
    containerId: string;
    referenceId: string;
    rootId: string;
    type: ElementLayoutType;
  };
} & T;
