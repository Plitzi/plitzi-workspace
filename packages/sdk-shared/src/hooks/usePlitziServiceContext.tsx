/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import { createContext, use } from 'react';

import type { BuilderContextValue } from '../builder';
import type { NetworkContextValue } from '../network';
import type {
  CollectionContextValue,
  ComponentContextValue,
  DataSourceContextValue,
  EventBridgeContextValue,
  InteractionsContextValue,
  NavigationContextValue,
  PluginsContextValue,
  SchemaContextValue,
  SegmentsContextValue,
  StateManagerContextValue,
  StyleContextValue
} from '../types';
import type { Context, ReactNode, RefObject } from 'react';

export type PlitziServiceContextValue<TEventBridge = any, TInteractions = any> = {
  settings: { isHydrating?: boolean; previewMode?: boolean; environment?: string; [key: string]: unknown };
  root: { baseElementId: string };
  utils: {
    getWindow: () => Window | null;
    rootRef: RefObject<HTMLElement | null>;
  };
  customContexts: Record<string, Context<any>>;
  contexts: {
    DataSourceContext: Context<DataSourceContextValue>;
    SchemaContext: Context<SchemaContextValue>;
    StyleContext: Context<StyleContextValue>;
    SegmentsContext: Context<SegmentsContextValue>;
    NavigationContext: Context<NavigationContextValue>;
    CollectionContext: Context<CollectionContextValue>;
    ComponentContext: Context<ComponentContextValue>;
    StateManagerContext: Context<StateManagerContextValue>;
    EventBridgeContext: Context<EventBridgeContextValue<TEventBridge>>;
    PluginsContext: Context<PluginsContextValue>;
    InteractionsContext: Context<InteractionsContextValue<TInteractions>>;
    NetworkContext: Context<NetworkContextValue>;
    BuilderContext?: Context<BuilderContextValue>;
  };
};

const plitziServiceContextDefaultValue = {} as PlitziServiceContextValue;

export const PlitziServiceContext = createContext<PlitziServiceContextValue>(plitziServiceContextDefaultValue);

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

export { PlitziServiceProvider };

export default usePlitziServiceContext;
