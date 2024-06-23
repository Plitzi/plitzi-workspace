// Packages
import React, { use, useMemo } from 'react';
import get from 'lodash/get';

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
import StateManagerContext from '@pmodules/StateManager/StateManagerContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import NetworkContext from '@pmodules/Network/NetworkContext';

/**
 * @param {{
 *   children?: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceBuilderContextProvider = props => {
  const { children } = props;
  const { state } = use(StateManagerContext);
  const { pages: pageIds, pageDefinitions } = use(SchemaMainContext);
  const {
    schema: { variables }
  } = use(SchemaContext);
  const { environment } = use(NetworkContext);
  const { routeParams, queryParams, hostname } = use(NavigationContext);
  const { userProvider } = use(SchemaSettingsContext);
  const variablesData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );
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
      <UserSource userProvider={userProvider}>
        <VariablesSource variables={variables} whenData={variablesData}>
          <NavigationSource>
            <PageStateSource state={state} pages={pageOptions}>
              {children}
            </PageStateSource>
          </NavigationSource>
        </VariablesSource>
      </UserSource>
    </DataSourceContextProvider>
  );
};

export default DataSourceBuilderContextProvider;
