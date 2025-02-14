/* eslint-disable react-refresh/only-export-components */
// Packages
import { createContext, use } from 'react';

// Types
import type { PluginsContextValue } from '../types';
import type { Context, ReactNode } from 'react';

export type PlitziServiceContextValue = {
  settings: Record<string, unknown>;
  contexts: { PluginsContext: Context<PluginsContextValue> } & Record<string, Context<unknown>>;
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
