// Packages
import React, { useContext } from 'react';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import NavigationSource from '@plitzi/sdk-data-source/sources/NavigationSource';
import PageStateSource from '@plitzi/sdk-data-source/sources/PageStateSource';

// Alias
import StateManagerContext from '@modules/StateManager/StateManagerContext';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceSdkContextProvider = props => {
  const { children } = props;
  const { state } = useContext(StateManagerContext);

  return (
    <DataSourceContextProvider>
      <NavigationSource>
        <PageStateSource state={state}>{children}</PageStateSource>
      </NavigationSource>
    </DataSourceContextProvider>
  );
};

export default DataSourceSdkContextProvider;
