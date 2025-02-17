import type { Element, InteractionCallback } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type BaseInternalProps = { id: string; rootId?: string; className?: string };

export type InternalProps = BaseInternalProps & {
  definition: Element['definition'];
  attributes: Element['attributes'];
  style?: CSSProperties;
  interactions?: Element['definition']['interactions'];
  interactionsBasicCallbacks?: Record<string, InteractionCallback>;
  elementState?: Record<string, string | boolean | number>;
  plitziElementLayout?: {
    bodyChildren: ReactNode;
    containerId: string;
    referenceId: string;
    rootId: string;
    type: 'layout' | 'segment' | 'element' | 'reference';
  };
};
