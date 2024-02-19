// Packages
import React from 'react';
import PropTypes from 'prop-types';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';

// Relatives
import PageStateContextProvider from './sources/PageSource/PageStateContextProvider';

const DataSourceBuilderContextProvider = props => {
  const { children } = props;

  return (
    <DataSourceContextProvider>
      <PageStateContextProvider>{children}</PageStateContextProvider>
    </DataSourceContextProvider>
  );
};

DataSourceBuilderContextProvider.propTypes = {
  children: PropTypes.node
};

export default DataSourceBuilderContextProvider;
