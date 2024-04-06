// Packages
import React, { useContext } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import NavigationSource from '@plitzi/sdk-data-source/sources/NavigationSource';
import PageStateSource from '@plitzi/sdk-data-source/sources/PageStateSource';

// Alias
import StateManagerContext from '@modules/StateManager/StateManagerContext';

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

DataSourceSdkContextProvider.propTypes = {
  children: PropTypes.node
};

export default DataSourceSdkContextProvider;
