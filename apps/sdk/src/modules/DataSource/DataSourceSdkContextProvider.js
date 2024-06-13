// Packages
import React, { use } from 'react';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import NavigationSource from '@plitzi/sdk-data-source/sources/NavigationSource';
import PageStateSource from '@plitzi/sdk-data-source/sources/PageStateSource';
import VariablesSource from '@plitzi/sdk-data-source/sources/VariablesSource';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

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

  return (
    <DataSourceContextProvider>
      <VariablesSource variables={variables}>
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
