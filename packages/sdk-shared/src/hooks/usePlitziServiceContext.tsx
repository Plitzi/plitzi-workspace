/* eslint-disable react-refresh/only-export-components */
// Packages
import { createContext, use } from 'react';

// Types
import type { ReactNode } from 'react';

const plitziServiceContextDefaultValue: unknown = undefined;

export const PlitziServiceContext = createContext(plitziServiceContextDefaultValue);

const usePlitziServiceContext = () => {
  const context = use(PlitziServiceContext);
  if (context === undefined) {
    throw new Error(
      'ServiceContext value is undefined. Make sure you use the PlitziServiceProvider before using the hook.'
    );
  }

  return context;
};

const PlitziServiceProvider = (props: { children?: ReactNode; value: unknown }) => {
  const { children, value } = props;

  return <PlitziServiceContext value={value}>{children}</PlitziServiceContext>;
};

export { PlitziServiceProvider };

export default usePlitziServiceContext;
