/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import { createContext, use } from 'react';

import type { BuilderContextValue } from '../builder';
import type { NetworkContextValue } from '../network';
import type {
  CollectionContextValue,
  ComponentContextValue,
  EventBridgeContextValue,
  InteractionsContextValue,
  NavigationContextValue,
  PluginsContextValue,
  SegmentsContextValue,
  Theme
} from '../types';
import type { Context, ReactNode, RefObject } from 'react';

export type PlitziServiceContextValue<TEventBridge = any, TInteractions = any> = {
  settings: {
    isHydrating?: boolean;
    previewMode?: boolean;
    environment?: string;
    [key: string]: unknown;
    theme: Theme;
  };
  root: { baseElementId: string };
  utils: {
    getWindow: () => Window | null;
    rootRef: RefObject<HTMLElement | null>;
  };
  customContexts: Record<string, Context<any>>;
  contexts: {
    SegmentsContext: Context<SegmentsContextValue>;
    NavigationContext: Context<NavigationContextValue>;
    CollectionContext: Context<CollectionContextValue>;
    ComponentContext: Context<ComponentContextValue>;
    EventBridgeContext: Context<EventBridgeContextValue<TEventBridge>>;
    PluginsContext: Context<PluginsContextValue>;
    InteractionsContext: Context<InteractionsContextValue<TInteractions>>;
    NetworkContext: Context<NetworkContextValue>;
    BuilderContext?: Context<BuilderContextValue>;
  };
};

const plitziServiceContextDefaultValue = {} as PlitziServiceContextValue;

const PlitziServiceContext = createContext<PlitziServiceContextValue>(plitziServiceContextDefaultValue);
PlitziServiceContext.displayName = 'PlitziServiceContext';

const usePlitziServiceContext = <TEventBridge = any, TInteractions = any>() => {
  const context = use(PlitziServiceContext) as PlitziServiceContextValue<TEventBridge, TInteractions> | undefined;
  if (context === undefined) {
    throw new Error(
      'ServiceContext value is undefined. Make sure you use the PlitziServiceProvider before using the hook.'
    );
  }

  return context;
};

const PlitziServiceProvider = (props: { children?: ReactNode; value: PlitziServiceContextValue }) => {
  const { children, value } = props;

  return <PlitziServiceContext value={value}>{children}</PlitziServiceContext>;
};

export { PlitziServiceProvider, PlitziServiceContext };

export default usePlitziServiceContext;
