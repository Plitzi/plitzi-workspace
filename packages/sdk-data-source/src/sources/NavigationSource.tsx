import { useCallback, use, useMemo } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';

import DataSourceContext from '../DataSourceContext';

import type { ReactNode } from 'react';

export type NavigationSourceProps = {
  children?: ReactNode;
};

const NavigationSource = ({ children }: NavigationSourceProps) => {
  const { useDataSource } = use(DataSourceContext);
  const { routeParams, queryParams } = use(NavigationContext);
  const { currentPageId } = use(NavigationContext);

  const sourceFields = useCallback(
    () => [
      ...getPathsFromObeject({ routeParams, queryParams, currentPageId }).reduce<{ path: string; name: string }[]>(
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
    mode: 'write',
    name: 'Navigation',
    fields: sourceFields
  });

  return <NavigationSourceContext value={sourceValue}>{children}</NavigationSourceContext>;
};

export default NavigationSource;
