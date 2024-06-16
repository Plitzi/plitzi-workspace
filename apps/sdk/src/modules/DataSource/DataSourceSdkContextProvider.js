// Packages
import React, { use, useMemo } from 'react';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import NavigationSource from '@plitzi/sdk-data-source/sources/NavigationSource';
import PageStateSource from '@plitzi/sdk-data-source/sources/PageStateSource';
import VariablesSource from '@plitzi/sdk-data-source/sources/VariablesSource';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

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
  const { state } = use(StateManagerContext);
  const {
    schema: { variables }
  } = use(SchemaContext);
  const { routeParams, queryParams, hostname } = use(NavigationContext);
  const variablesData = useMemo(() => ({ routeParams, queryParams, hostname }), [routeParams, queryParams, hostname]);

  return (
    <DataSourceContextProvider>
      <VariablesSource variables={variables} whenData={variablesData}>
        <NavigationSource>
          <PageStateSource state={state}>
            {children}
          </PageStateSource>
        </NavigationSource>
      </VariablesSource>
    </DataSourceContextProvider>
  );
};

export default DataSourceSdkContextProvider;
