// Packages
import React, { createContext, useContext } from 'react';

export const PlitziServiceContext = createContext(undefined);

const usePlitziServiceContext = () => {
  const context = useContext(PlitziServiceContext);

  if (context === undefined) {
    throw new Error(
      'ServiceContext value is undefined. Make sure you use the PlitziServiceProvider before using the hook.'
    );
  }

  return context;
};

const PlitziServiceProvider = props => {
  const { children, value } = props;

  return <PlitziServiceContext.Provider value={value}>{children}</PlitziServiceContext.Provider>;
};

export { PlitziServiceProvider };

export default usePlitziServiceContext;
