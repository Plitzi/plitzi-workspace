// Packages
import React from 'react';
import PropTypes from 'prop-types';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';

// Relatives
import PageStateContextProvider from './sources/PageSource/PageStateContextProvider';

const DataSourceSdkContextProvider = props => {
  const { children } = props;

  return (
    <DataSourceContextProvider>
      <PageStateContextProvider>{children}</PageStateContextProvider>
    </DataSourceContextProvider>
  );
};

DataSourceSdkContextProvider.propTypes = {
  children: PropTypes.node
};

export default DataSourceSdkContextProvider;
