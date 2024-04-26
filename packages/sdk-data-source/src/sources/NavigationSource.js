// Packages
import { useCallback, useContext, useMemo } from 'react';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

const NavigationSource = props => {
  const { children } = props;
  const { useDataSource } = useContext(DataSourceContext);
  const { routeParams, queryParams } = useContext(NavigationContext);

  const sourceFields = useCallback(
    async () => [
      ...getPathsFromObeject({ routeParams, queryParams }).reduce((acum, path) => [...acum, { path, name: path }], []),
      { path: 'currentPageId', name: 'Current Page' }
    ],
    [routeParams, queryParams]
  );

  const sourceValue = useMemo(() => ({ routeParams, queryParams }), [routeParams, queryParams]);

  useDataSource({
    id: 'global',
    source: 'navigation',
    name: 'Navigation',
    value: sourceValue,
    fields: sourceFields
  });

  return children;
};

export default NavigationSource;
