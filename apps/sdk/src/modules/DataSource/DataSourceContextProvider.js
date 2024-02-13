// Packages
import React, { useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

// Alias
import SchemaContext from '@modules/Schema/SchemaContext';

// Relatives
import DataSourceContext from './DataSourceContext';
import useDataSource from './hooks/useDataSource';
import PageStateContextProvider from './sources/PageSource/PageStateContextProvider';
import DataSourceManager from './DataSourceManager';

const DataSourceContextProvider = props => {
  const { children } = props;
  const { schema } = useContext(SchemaContext);
  const dataSourceManager = useMemo(() => new DataSourceManager(), []);
  dataSourceManager.schema = schema;

  const valueMemo = useMemo(() => ({ dataSourceManager, useDataSource }), [dataSourceManager, useDataSource]);

  return (
    <DataSourceContext.Provider value={valueMemo}>
      <PageStateContextProvider>{children}</PageStateContextProvider>
    </DataSourceContext.Provider>
  );
};

DataSourceContextProvider.propTypes = {
  children: PropTypes.node
};

export default DataSourceContextProvider;
