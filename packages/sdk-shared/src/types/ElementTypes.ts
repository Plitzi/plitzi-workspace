import type { PluginManifest, PluginSchema } from './PluginTypes';
import type { Element, InteractionBaseCallback } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

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
    type: 'layout' | 'segment' | 'element' | 'reference';
  };
} & T;

export type ComponentDefinition = Pick<PluginSchema, 'attributes' | 'builder' | 'definition' | 'defaultStyle'> & {
  assets: { type: 'style' | 'script'; url: string }[];
  manifest: PluginManifest;
  market: Omit<PluginManifest, 'name'> & { category: string };
  settings: { [key: string]: unknown };
};
