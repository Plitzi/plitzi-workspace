/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import { createContext, use } from 'react';

import type { BuilderContextValue } from '../builder';
import type { DataSourceContextValue } from '../dataSource';
import type {
  CollectionContextValue,
  ComponentContextValue,
  EventBridgeContextValue,
  InteractionsContextValue,
  NavigationContextValue,
  PluginsContextValue,
  SchemaContextValue,
  SegmentsContextValue,
  StateManagerContextValue
} from '../types';
import type { Context, ReactNode } from 'react';

export type PlitziServiceContextValue = {
  settings: { previewMode?: boolean; environment?: string; [key: string]: unknown };
  root: { baseElementId: string };
  utils: {
    getWindow: () => Window | null;
    rootDOM?: HTMLElement | null;
  };
  customContexts: Record<string, Context<any>>;
  contexts: {
    DataSourceContext: Context<DataSourceContextValue>;
    SchemaContext: Context<SchemaContextValue>;
    SegmentsContext: Context<SegmentsContextValue>;
    NavigationContext: Context<NavigationContextValue>;
    CollectionContext: Context<CollectionContextValue>;
    ComponentContext: Context<ComponentContextValue>;
    StateManagerContext: Context<StateManagerContextValue>;
    EventBridgeContext: Context<EventBridgeContextValue>;
    PluginsContext: Context<PluginsContextValue>;
    InteractionsContext: Context<InteractionsContextValue>;
    NetworkContext: Context<any>;
    BuilderContext?: Context<BuilderContextValue>;
  };
} & Record<string, unknown>;

const plitziServiceContextDefaultValue = {} as PlitziServiceContextValue;

export const PlitziServiceContext = createContext<PlitziServiceContextValue>(plitziServiceContextDefaultValue);

const usePlitziServiceContext = () => {
  const context = use(PlitziServiceContext) as PlitziServiceContextValue | undefined;
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
