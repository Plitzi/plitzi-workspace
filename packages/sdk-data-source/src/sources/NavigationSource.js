// Packages
import React, { useCallback, use, useMemo } from 'react';

// Monorepo
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Relatives
import DataSourceContext from '../DataSourceContext.js';
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
  const { currentPageId } = use(NavigationContext);

  const sourceFields = useCallback(
    async () => [
      ...getPathsFromObeject({ routeParams, queryParams, currentPageId }).reduce(
        (acum, path) => [...acum, { path, name: `navigation.${path}` }],
        []
      ),
      { path: 'currentPageId', name: 'Current Page' }
    ],
    [routeParams, queryParams, currentPageId]
  );

  const sourceValue = useMemo(
    () => ({ routeParams, queryParams, currentPageId }),
    [routeParams, queryParams, currentPageId]
  );

  const [NavigationSourceContext] = useDataSource({
    id: 'global',
    source: 'navigation',
    name: 'Navigation',
    fields: sourceFields
  });

  return <NavigationSourceContext value={sourceValue}>{children}</NavigationSourceContext>;
};

export default NavigationSource;
