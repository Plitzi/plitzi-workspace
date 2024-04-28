// Packages
import React, { createContext, use } from 'react';

export const PlitziServiceContext = createContext(undefined);

const usePlitziServiceContext = () => {
  const context = use(PlitziServiceContext);
  if (context === undefined) {
    throw new Error(
      'ServiceContext value is undefined. Make sure you use the PlitziServiceProvider before using the hook.'
    );
  }

  return context;
};

/**
 * @param {{
 *   children: React.ReactNode;
 *   value: any;
 * }} props
 * @returns {React.ReactElement}
 */
const PlitziServiceProvider = props => {
  const { children, value } = props;

  return <PlitziServiceContext.Provider value={value}>{children}</PlitziServiceContext.Provider>;
};

export { PlitziServiceProvider };

export default usePlitziServiceContext;
