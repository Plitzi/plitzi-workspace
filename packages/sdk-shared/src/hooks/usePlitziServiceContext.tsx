/* eslint-disable react-refresh/only-export-components */
import { createContext, use } from 'react';

import type {
  DataSourceContextValue,
  EventBridgeContextValue,
  InteractionsContextValue,
  PluginsContextValue,
  SchemaContextValue
} from '../types';
import type { Context, ReactNode } from 'react';

export type PlitziServiceContextValue = {
  settings: Record<string, unknown>;
  root: { baseElementId: string };
  contexts: {
    PluginsContext: Context<PluginsContextValue>;
    InteractionsContext: Context<InteractionsContextValue>;
    DataSourceContext: Context<DataSourceContextValue>;
    SchemaContext: Context<SchemaContextValue>;
    EventBridgeContext: Context<EventBridgeContextValue>;
  } & Record<string, Context<unknown>>;
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
