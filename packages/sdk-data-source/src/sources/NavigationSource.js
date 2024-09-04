// Packages
import React, { useCallback, use, useMemo } from 'react';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const NavigationSource = props => {
  const { children } = props;
  const { useDataSource } = use(DataSourceContext);
  const { routeParams, queryParams } = use(NavigationContext);

  const sourceFields = useCallback(
    async () => [
      ...getPathsFromObeject({ routeParams, queryParams }).reduce(
        (acum, path) => [...acum, { path, name: `navigation.${path}` }],
        []
      ),
      { path: 'currentPageId', name: 'Current Page' }
    ],
    [routeParams, queryParams]
  );

  const sourceValue = useMemo(() => ({ routeParams, queryParams }), [routeParams, queryParams]);

  const [NavigationSourceContext] = useDataSource({
    id: 'global',
    source: 'navigation',
    name: 'Navigation',
    fields: sourceFields
  });

  return <NavigationSourceContext value={sourceValue}>{children}</NavigationSourceContext>;
};

export default NavigationSource;
