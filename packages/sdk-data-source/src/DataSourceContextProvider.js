// Packages
import React, { useContext, useMemo } from 'react';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Relatives
import DataSourceContext from './DataSourceContext';
import useDataSource from './hooks/useDataSource';
import DataSourceManager from './DataSourceManager';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceContextProvider = props => {
  const { children } = props;
  const { schema } = useContext(SchemaContext);
  const { currentPageId } = useContext(NavigationContext);
  const dataSourceManager = useMemo(() => new DataSourceManager(), []);
  dataSourceManager.schema = schema;
  dataSourceManager.currentPageId = currentPageId;

  const valueMemo = useMemo(() => ({ dataSourceManager, useDataSource }), [dataSourceManager, useDataSource]);

  return <DataSourceContext.Provider value={valueMemo}>{children}</DataSourceContext.Provider>;
};

export default DataSourceContextProvider;
