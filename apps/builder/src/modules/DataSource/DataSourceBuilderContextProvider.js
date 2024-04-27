// Packages
import React, { useContext, useMemo } from 'react';
import get from 'lodash/get';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import NavigationSource from '@plitzi/sdk-data-source/sources/NavigationSource';
import PageStateSource from '@plitzi/sdk-data-source/sources/PageStateSource';

// Alias
import StateManagerContext from '@pmodules/StateManager/StateManagerContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

/**
 * @param {{
 *   children?: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceBuilderContextProvider = props => {
  const { children } = props;
  const { state } = useContext(StateManagerContext);
  const { pages: pageIds, pageDefinitions } = useContext(SchemaMainContext);

  const pageOptions = useMemo(
    () =>
      pageIds.reduce((acum, pageId) => {
        const pageName = get(pageDefinitions, `${pageId}.attributes.name`, pageId);

        return [...acum, { value: pageId, label: pageName }];
      }, []),
    [pageDefinitions, pageIds]
  );

  return (
    <DataSourceContextProvider>
      <NavigationSource>
        <PageStateSource state={state} pages={pageOptions}>
          {children}
        </PageStateSource>
      </NavigationSource>
    </DataSourceContextProvider>
  );
};

export default DataSourceBuilderContextProvider;
