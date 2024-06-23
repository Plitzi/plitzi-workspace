// Packages
import React, { use, useMemo } from 'react';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import NavigationSource from '@plitzi/sdk-data-source/sources/NavigationSource';
import PageStateSource from '@plitzi/sdk-data-source/sources/PageStateSource';
import VariablesSource from '@plitzi/sdk-data-source/sources/VariablesSource';
import UserSource from '@plitzi/sdk-data-source/sources/UserSource';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

// Alias
import StateManagerContext from '@modules/StateManager/StateManagerContext';
import NetworkContext from '@modules/Network/NetworkContext';

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
  const { userProvider } = use(SchemaSettingsContext);
  const { environment } = use(NetworkContext);
  const variablesData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );

  return (
    <DataSourceContextProvider>
      <UserSource userProvider={userProvider}>
        <VariablesSource variables={variables} whenData={variablesData}>
          <NavigationSource>
            <PageStateSource state={state}>{children}</PageStateSource>
          </NavigationSource>
        </VariablesSource>
      </UserSource>
    </DataSourceContextProvider>
  );
};

export default DataSourceSdkContextProvider;
